import {Logger, LoggerManager} from "typescript-logger";
import Peer from "peerjs";
import {INetplayEventHandlers} from "./NetplayClient";
import {Console} from "../console/Console";
import {joypadForP1, joypadForP2, joypadForNetplay} from "../console/controller/Controller";
import {Keyboard} from "../../web/Keyboard";

const HOST = window.location.hostname;
const PORT = 9000;

export enum INetplayPayloadType {
    RESET, STOP, PLAY, KEYS, READY,
}

export interface INetplayPayload {
    type: INetplayPayloadType;
    message: Record<string, string>;
}

export class NetplayLeader {

    public log : Logger = LoggerManager.create('NetplayLeader');
    public id: number = 1;
    public roomId: string;

    public capacity: number;
    public connections: Record<string, Peer.DataConnection> = {};

    private console: Console;
    private handlers: INetplayEventHandlers;
    public broker: Peer;


    public constructor(capacity: number, console: Console) {
        this.capacity = Math.max(0, capacity - 1);
        this.console = console;
    }

    public setHandlers(handlers: INetplayEventHandlers) {
        this.handlers = handlers;
    }

    public connect(): void {
        const { handlers } = this;

        const broker = new Peer({
            host: HOST,
            port: PORT,
        });

        this.broker = broker;
        this.connections = {};

        broker.on('error', (err) => {
            if (handlers && handlers.onError) handlers.onError(err);
            this.broker = null;
        });

        broker.on('open', (id) => {
            this.applyOnCreate(id);
            if (handlers && handlers.onCreate) handlers.onCreate(id);

            broker.on('connection', (conn: Peer.DataConnection) => {
                const occupants = Object.keys(this.connections).length;
                const isFull = occupants + 1 > this.capacity;
                if (isFull) {
                    try { conn.close(); } catch (e) {}
                    return;
                }

                conn.on('close', () => {
                    this.applyOnDisconnect(conn);
                    if (handlers && handlers.onDisconnect) handlers.onDisconnect();
                });

                conn.on('error', (err) => {
                    this.applyOnError(conn, err);
                    if (handlers && handlers.onError) handlers.onError(err);
                });

                conn.on('data', (data) => {
                    this.applyOnData(conn, data);
                    if (handlers && handlers.onData) handlers.onData(data);
                });

                conn.on('open', () => {
                    this.applyOnConnect(conn);
                    if (handlers && handlers.onConnect) handlers.onConnect();
                });
            });
        });
    }

    public disconnect(): void {
        this.broker.destroy();
        this.broker = null;
    }

    public reset(): void {
        if (!this.broker) return;
        if (this.console.cartridge.rom.length == 0) return;

        this.console.stop();
        const state = this.console.saveState();
        this.console.reset();
        this.console.loadState(state);

        for (const connection of Object.values(this.connections)) {
            connection.send(createMessage(
                INetplayPayloadType.STOP,
            ));
            connection.send(createMessage(
                INetplayPayloadType.RESET,
                state,
            ));
        }
    }

    private applyOnError(conn: Peer.DataConnection, err: any): void {
        try { conn.close(); } catch (e) {}
        delete this.connections[conn.peer];
    }

    private applyOnConnect(conn: Peer.DataConnection): void {
        this.connections[conn.peer] = conn;

        this.reset();
    }

    private applyOnCreate(id: string): void {
        this.roomId = id;
        Keyboard.initialize(joypadForNetplay);
    }

    private applyOnData(conn: Peer.DataConnection, data: any): void {
        const { console, handlers } = this;
        const json: { type: INetplayPayloadType, message?: any } = JSON.parse(data);

        const type  = json.type;
        const message  = json.message;

        if (type == INetplayPayloadType.KEYS) {
            const id = message.id;
            const joy2State = message.controller2;
            const joy1State = joypadForNetplay.saveState();

            joypadForP1.loadState(joy1State);
            joypadForP2.loadState(joy2State);

            requestAnimationFrame(() => {
                console.ticks(console.tpf);
            });

            conn.send(createMessage(INetplayPayloadType.KEYS, {
                controller1: joy1State,
                controller2: joy2State,
            }));
        } else if (type == INetplayPayloadType.READY) {
            conn.send(createMessage(INetplayPayloadType.READY));
        }
    }

    private applyOnDisconnect(conn: Peer.DataConnection): void {
        try { conn.close(); } catch (e) {}
        delete this.connections[conn.peer];
    }

}

export function createMessage(type: INetplayPayloadType, message?: any) {
    return JSON.stringify({
        type,
        message,
    });
}