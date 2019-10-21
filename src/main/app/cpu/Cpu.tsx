import {Mode, Modes} from "../Modes";
import {Registers} from "./Registers";
import {Opcode, Opcodes, OpContext} from "./Opcodes";
import {InterruptHandler} from "./Interrupts";
import {Cartridge} from "../cartridge/Cartridge";
import {Bus} from "../bus/Bus";
import {Objects} from "../util/Objects";
import {Logger, LoggerManager} from "typescript-logger";
import Console from "../Console";
import {Result} from "../bus/Result";
import {Address} from "../bus/Address";
import {Stack} from "../memory/Stack";
import {Wram} from "../memory/Wram";


export class Cpu {

    public log : Logger = LoggerManager.create('Cpu');

    public registers: Registers = new Registers();
    public opcodes: Opcodes = new Opcodes();
    public console: Console;
    public interrupts: InterruptHandler;

    public stack: Stack;
    public wram: Wram;

    public cycles: number = 0;

    constructor(console: Console) {
        Objects.requireNonNull(console);

        this.console = console;
        this.interrupts = new InterruptHandler(this);
    }

    public tick(): number {
        this.interrupts.tick();

        let pc: number = this.registers.pc.get();
        let bank: number = this.registers.k.get();
        let cycles = this.cycles;

        let opaddr: Address = Address.create(pc, bank);
        let opcode: Result = this.console.bus.readByte(opaddr);
        let op: Opcode = this.opcodes.get(opcode.getValue());

        let context: OpContext = new OpContext(opaddr, op, this.console);
        op.execute(context);

        this.registers.pc.set(opaddr.toValue() + op.getSize());
        this.cycles += op.getCycle();
        let duration = this.cycles - cycles;

        return duration;
    }

    public reset(): void {
        this.registers.p.set(0x0);
        this.registers.p.setI(0x1);
        this.registers.p.setX(0x1);
        this.registers.p.setM(0x1);

        this.registers.sp.set(0x100);
        this.registers.e.set(0x1);

        this.registers.pc.set(this.console.cartridge.interrupts.emulation.RESET);
    }
}






