import {Objects} from "../util/Objects";
import {Console} from "../console/Console";

const CLEAR_MASKS: number[] = [0xFFFF00, 0xFF00FF, 0x00FFFF];
const SHIFTS: number[] = [0, 8, 16];

export class AbstractRegister {

    private value: number = 0;
    protected console: Console;

    constructor(console: Console) {
        this.console = console;
    }

    public set(value : number, byteIndex?: number): void {
        Objects.requireNonNull(value);

        if (byteIndex == null) {
            this.value = value;
        } else {
            this.setByteAt(value, byteIndex);
        }
    }

    public get(byteIndex?: number): number {
        if (byteIndex == null) {
            return this.value;
        }
        return this.getByteAt(byteIndex);
    }

    private setByteAt(value: number, index: number): void {
        Objects.requireNonNull(value);
        Objects.requireNonNull(index);

        if (value == null || value < 0 || value > 0xFF) {
            throw new Error(`Invalid value given ${value}`);
        }

        if (index < 0 || index > 2) {
            throw new Error(`Invalid index given ${index}`);
        }

        this.value &= CLEAR_MASKS[index];
        this.value |= (value << SHIFTS[index]);
    }

    private getByteAt(index: number) {
        Objects.requireNonNull(index);

        if (index < 0 || index > 2) {
            throw new Error(`Invalid index given ${index}`);
        }

        const byte = (this.value >>> SHIFTS[index]) & 0xFF;
        return byte;
    }

}