import {Objects} from "../../util/Objects";
import {Console} from "../Console";
import {Cpu} from "./Cpu";
import {Bus} from "../bus/Bus";
import {Registers} from "./Registers";
import {Addressing, AddressingModes, IAddressingMode} from "./Addressing";
import {Bit} from "../../util/Bit";
import {InterruptType} from "./Interrupts";
import {AddressUtil} from "../../util/AddressUtil";


export class OpContext {

    public opaddr: number;
    public op: Operation;

    public console: Console;
    public cpu: Cpu;
    public bus: Bus;
    public registers: Registers;

    private static singleton: OpContext = null;

    constructor(cpu: Cpu, opaddr: number, op: Operation) {
        Objects.requireNonNull(cpu);
        Objects.requireNonNull(cpu.console);
        Objects.requireNonNull(cpu.console.bus);
        Objects.requireNonNull(cpu.registers);

        this.cpu = cpu;
        this.console = cpu.console;
        this.bus = cpu.console.bus;
        this.registers = cpu.registers;

        this.opaddr = opaddr;
        this.op = op;
    }

    public static create(cpu: Cpu, opaddr: number, op: Operation): OpContext {
        if (OpContext.singleton) {
            OpContext.singleton.opaddr = opaddr;
            OpContext.singleton.op = op;
            return OpContext.singleton;
        }
        OpContext.singleton = new OpContext(cpu, opaddr, op);
        return OpContext.singleton;
    }

    public getOperand(index: number): number {
        if (index < 0) {
            throw new Error("Invalid operand request");
        }

        let address: number = this.opaddr + index + 1;
        return this.bus.readByte(address);
    }

    public getOperandAddress(index: number): number {
        if (index < 0) {
            throw new Error("Invalid operand request");
        }

        let address: number = this.opaddr + index + 1;
        return address;
    }

    public setFlagC(val: number, is8Bit?: boolean): void {
        if (is8Bit == null) is8Bit = true;
        if (val == null || val < 0) {
            throw new Error("Invalid flag calculation!");
        }

        let mask = (is8Bit || false) ? 0x80 : 0x8000;
        let isCarry = (val & mask) != 0;

        this.registers.p.setC(isCarry ? 1 : 0);
    }

    public setFlagZ(val: number, is8Bit?: boolean): void {
        if (is8Bit == null) is8Bit = true;
        if (val == null || val < 0) {
            throw new Error("Invalid flag calculation! " + val.toString(16) + " " + is8Bit);
        }

        let mask: number = (is8Bit || false) ? 0xFF : 0xFFFF;
        this.registers.p.setZ((val & mask) == 0 ? 1 : 0);
    }

    public setFlagV(a: number, b: number, is8Bit?: boolean): void {
        if (a == null || b == null || a < 0 || b < 0) {
            throw new Error("Invalid flag calculation!");
        }

        let mask: number = (is8Bit || false) ? 0x80 : 0x8000;
        let sum = a + b;
        let isOverflow = ((!(((a ^ b) & mask) != 0) && (((a ^ sum) & mask)) != 0) ? 1 : 0);
        this.registers.p.setV(isOverflow ? 1 : 0);
    }

    public setFlagN(val: number, is8Bit?: boolean): void {
        if (is8Bit == null) is8Bit = true;
        if (val == null || val < 0) {
            throw new Error("Invalid flag calculation!");
        }

        let mask: number = (is8Bit || false) ? 0x80 : 0x8000;
        let isNegative: boolean = (mask & val) != 0;
        this.registers.p.setN(isNegative ? 1 : 0);
    }
}

export class OpResult {
    public size: number = 0;
    public cycles: number = 0;

    public with(size: number, cycles: number): OpResult {
        this.size = size;
        this.cycles = cycles;

        return this;
    }
}

export class Operation {

    protected result: OpResult = new OpResult();

    public name: string;
    public code: number;
    public cycle: number;
    public size: number;
    public mode: IAddressingMode;
    public cpu: Cpu;

    constructor(cpu: Cpu, code: number, cycle: number, size: number, mode: IAddressingMode) {
        Objects.requireNonNull(mode);
        Objects.requireNonNull(cpu);

        this.cpu = cpu;
        this.code = code;
        this.cycle = cycle;
        this.mode = mode;
        this.size = size;
    }

    public execute(context: OpContext): number {
        return null;
    }

    public getSize(): number {
        return this.size;
    }

}

export class ADC extends Operation {
    public name: string = "ADC";

    public execute(context: OpContext): number {
        let is8Bit: boolean = context.registers.p.getM() == 1;
        let isBcdMode: boolean = context.registers.p.getD() == 1;
        let mask: number = is8Bit ? 0xFF : 0xFFFF;
        let size: number = is8Bit ? 0x80 : 0x8000;
        let overflow: number = is8Bit ? 0x9F : 0x9FFF;

        let a: number = context.cpu.registers.a.get() & mask;
        let b: number = this.mode.getValue(context) & mask;
        let c: number = context.cpu.registers.p.getC();

        let result: number = 0;
        if (isBcdMode) {
            let an0 = a & 0x000f;
            let an1 = a & 0x00f0;
            let an2 = a & 0x0f00;
            let an3 = a & 0xf000;

            let bn0 = b & 0x000f;
            let bn1 = b & 0x00f0;
            let bn2 = b & 0x0f00;
            let bn3 = b & 0xf000;

            an0 = an0 + c;

            an0 = an0 + bn0;
            an1 = an1 + bn1;
            an2 = an2 + bn2;
            an3 = an3 + bn3;

            if (an0 > 0x9) an0 = an0 + 0x6;
            if (an0 > 0xf) an1 = an1 + 0x10;
            an0 = an0 & 0x000f;

            if (!is8Bit) {
                if (an1 > 0x9f) an1 = an1 + 0x60;
                if (an1 > 0xff) an2 = an2 + 0x100;
                an1 = an1 & 0x00f0;

                if (an2 > 0x9ff) an2 = an2 + 0x600;
                if (an2 > 0xfff) an3 = an3 + 0x1000;
                an2 = an2 & 0x0f00;
            }

            result = an0 + an1 + an2 + an3;
            context.registers.p.setV((~(a ^ b) & (a ^ result) & size) != 0 ? 1 : 0);
            if (result > overflow) result = result + (is8Bit ? 0x60: 0x6000);
        } else {
            result = a + b + c;
            context.registers.p.setV((~(a ^ b) & (a ^ result) & size) != 0 ? 1 : 0);
        }

        context.registers.p.setC(result > mask ? 1: 0);
        result &= mask;

        if (is8Bit) context.registers.a.setA(result & mask);
        if (!is8Bit) context.registers.a.setC(result & mask);

        context.setFlagN(result, is8Bit);
        context.setFlagZ(result, is8Bit);

        return this.cycle;
    }

    public getSize(): number {
        let isImmediate: boolean = this.mode == AddressingModes.immediateM;
        if (isImmediate && this.cpu.registers.p.getM() == 1) {
            return super.getSize() - 1;
        }
        return super.getSize();
    }

}

export class AND extends Operation {
    public name: string = "AND";

    public execute(context: OpContext): number {
        let a: number = context.cpu.registers.a.get();
        let b: number = this.mode.getValue(context);

        let is8Bit: boolean = context.registers.p.getM() == 1;
        let mask: number = is8Bit ? 0xFF : 0xFFFF;
        let result: number = (a & mask) & (b & mask);

        if (is8Bit) context.cpu.registers.a.setA(result & mask);
        if (!is8Bit) context.cpu.registers.a.setC(result & mask);

        context.setFlagZ(result, is8Bit);
        context.setFlagN(result, is8Bit);

        return this.cycle;
    }

    public getSize(): number {
        let isImmediate: boolean = this.mode == AddressingModes.immediateM;
        if (isImmediate && this.cpu.registers.p.getM() == 1) {
            return super.getSize() - 1;
        }
        return super.getSize();
    }
}

export class ASL extends Operation {
    public name: string = "ASL";

    public execute(context: OpContext): number {
        let is8Bit: boolean = context.registers.p.getM() == 1;
        let mask: number = is8Bit ? 0xFF : 0xFFFF;

        let b: number = this.mode.getValue(context) & mask;
        let result: number = (b << 1) & mask;

        if (this.mode == AddressingModes.accumulator) {
            if (is8Bit) context.registers.a.setA(result);
            if (!is8Bit) context.registers.a.setC(result);
        } else {
            let addressing: Addressing = this.mode.getAddressing(context);
            let loData: number = Bit.getUint16Lower(result) & 0xFF;
            let hiData: number = Bit.getUint16Upper(result) & 0xFF;

            context.bus.writeByte(addressing.toLow(), loData);
            if (!is8Bit) context.bus.writeByte(addressing.toHigh(), hiData);
        }

        context.setFlagZ(result, is8Bit);
        context.setFlagN(result, is8Bit);
        context.registers.p.setC((b >> (is8Bit ? 7 : 15)) & 1);

        return this.cycle;
    }

}

export class BCC extends Operation {
    public name: string = "BCC";

    public execute(context: OpContext): number {
        if (context.registers.p.getC() == 0) {
            let addressing: Addressing = this.mode.getAddressing(context);
            let pc: number = addressing.toLow();
            context.registers.pc.set(pc);

            return this.cycle;
        }
        return this.cycle;
    }
}

export class BCS extends Operation {
    public name: string = "BCS";

    public execute(context: OpContext): number {
        if (context.registers.p.getC() == 1) {
            let addressing: Addressing = this.mode.getAddressing(context);
            let pc: number = addressing.toLow();
            context.registers.pc.set(pc);

            return this.cycle;
        }
        return this.cycle;
    }
}

export class BEQ extends Operation {
    public name: string = "BEQ";

    public execute(context: OpContext): number {
        if (context.registers.p.getZ() == 1) {
            let addressing: Addressing = this.mode.getAddressing(context);
            let pc: number = addressing.toLow();
            context.registers.pc.set(pc);

            return this.cycle;
        }
        return this.cycle;
    }
}

export class BIT extends Operation {
    public name: string = "BIT";

    public execute(context: OpContext): number {
        let is8Bit: boolean = context.registers.p.getM() == 1;
        let mask: number = is8Bit ? 0xFF : 0xFFFF;
        let vMask = is8Bit ? 0x40 : 0x4000;
        let nMask = is8Bit ? 0x80 : 0x8000;

        let a: number = context.registers.a.get() & mask;
        let b: number = this.mode.getValue(context) & mask;

        let result = (a & mask) & (b & mask);

        let isImmediate: boolean = this.mode == AddressingModes.immediateM;
        if (!isImmediate) {
            context.registers.p.setV(((b & vMask) != 0) ? 1 : 0);
            context.registers.p.setN(((b & nMask) != 0) ? 1 : 0);
        }
        context.setFlagZ(result, is8Bit);

        return this.cycle;
    }

    public getSize(): number {
        let isImmediate: boolean = this.mode == AddressingModes.immediateM;
        if (isImmediate && this.cpu.registers.p.getM() == 1) {
            return super.getSize() - 1;
        }
        return super.getSize();
    }
}

class BMI extends Operation {
    public name: string = "BMI";

    public execute(context: OpContext): number {
        if (context.registers.p.getN() == 1) {
            let addressing: Addressing = this.mode.getAddressing(context);
            let pc: number = addressing.toLow();
            context.registers.pc.set(pc);

            return this.cycle;
        }

        return this.cycle;
    }

}

class BNE extends Operation {
    public name: string = "BNE";

    public execute(context: OpContext): number {
        if (context.registers.p.getZ() == 0) {
            let addressing: Addressing = this.mode.getAddressing(context);
            let pc: number = addressing.toLow();
            context.registers.pc.set(pc);

            return this.cycle;
        }

        return this.cycle;
    }
}

class BPL extends Operation {
    public name: string = "BPL";

    public execute(context: OpContext): number {
        if (context.registers.p.getN() == 0) {
            let addressing: Addressing = this.mode.getAddressing(context);
            let pc: number = addressing.toLow();
            context.registers.pc.set(pc);

            return this.cycle;
        }

        return this.cycle;
    }

}

class CMP extends Operation {
    public name: string = "CMP";

    public execute(context: OpContext): number {
        let is8Bit: boolean = context.registers.p.getM() == 1;
        let mask: number = is8Bit ? 0xFF : 0xFFFF;
        let negative: number = is8Bit ? 0x80 : 0x8000;

        let a: number = context.registers.a.get() & mask;
        let b: number = this.mode.getValue(context) & mask;

        let value: number = (a & mask) - (b & mask);

        context.registers.p.setC((a >= b ? 1 : 0));
        context.registers.p.setN((value & negative) != 0 ? 1 : 0);
        context.registers.p.setZ((value & mask) == 0 ? 1 : 0);

        return this.cycle;
    }

    public getSize(): number {
        let isImmediate: boolean = this.mode == AddressingModes.immediateM;
        if (isImmediate && this.cpu.registers.p.getM() == 1) {
            return super.getSize() - 1;
        }
        return super.getSize();
    }
}

class COP extends Operation {
    public name: string = "COP";

    public execute(context: OpContext): number {
        context.cpu.interrupts.set(InterruptType.COP);

        return this.cycle;
    }

}

class CPX extends Operation {
    public name: string = "CPX";

    public execute(context: OpContext): number {
        let is8Bit: boolean = context.registers.p.getX() == 1;
        let mask: number = is8Bit ? 0xFF : 0xFFFF;
        let size: number = is8Bit ? 7 : 15;

        let a: number = context.registers.x.get() & mask;
        let b: number = this.mode.getValue(context) & mask;

        let value: number = (a & mask) - (b & mask);

        context.registers.p.setC((a >= b ? 1 : 0));
        context.registers.p.setN((value >> size) & 1);
        context.registers.p.setZ(((value & mask) == 0) ? 1 : 0);

        return this.cycle;
    }

    public getSize(): number {
        let isImmediate: boolean = this.mode == AddressingModes.immediateX;
        if (isImmediate && this.cpu.registers.p.getX() == 1) {
            return super.getSize() - 1;
        }
        return super.getSize();
    }
}

class CPY extends Operation {
    public name: string = "CPY";

    public execute(context: OpContext): number {
        let is8Bit: boolean = context.registers.p.getX() == 1;
        let mask: number = is8Bit ? 0xFF : 0xFFFF;
        let size: number = is8Bit ? 7 : 15;

        let a: number = context.registers.y.get() & mask;
        let b: number = this.mode.getValue(context) & mask;

        let value: number = (a & mask) - (b & mask);

        context.registers.p.setC((a >= b ? 1 : 0));
        context.registers.p.setN((value >> size) & 1);
        context.registers.p.setZ(((value & mask) == 0) ? 1 : 0);

        return this.cycle;
    }

    public getSize(): number {
        let isImmediate: boolean = this.mode == AddressingModes.immediateX;
        if (isImmediate && this.cpu.registers.p.getX() == 1) {
            return super.getSize() - 1;
        }
        return super.getSize();
    }
}

class CLC extends Operation {
    public name: string = "CLC";

    public execute(context: OpContext): number {
        context.cpu.registers.p.setC(0);
        return this.cycle;
    }
}

class CLD extends Operation {
    public name: string = "CLD";

    public execute(context: OpContext): number {
        context.cpu.registers.p.setD(0);
        return this.cycle;
    }

}

class CLI extends Operation {
    public name: string = "CLI";

    public execute(context: OpContext): number {
        context.cpu.registers.p.setI(0);
        return this.cycle;
    }

}

class CLV extends Operation {
    public name: string = "CLV";

    public execute(context: OpContext): number {
        context.cpu.registers.p.setV(0);
        return this.cycle;
    }


}

class BRA extends Operation {
    public name: string = "BRA";

    public execute(context: OpContext): number {
        let addressing: Addressing = this.mode.getAddressing(context);
        let pc: number = addressing.toLow();
        context.registers.pc.set(pc);

        return this.cycle + (pc > 0xFF ? 1 : 0);
    }
}

class BRK extends Operation {
    public name: string = "BRK";

    public execute(context: OpContext): number {
        context.cpu.interrupts.set(InterruptType.BRK);
        throw new Error("BRK");
        return this.cycle;
    }

}

class BVS extends Operation {
    public name: string = "BVS";

    public execute(context: OpContext): number {
        if (context.registers.p.getV() == 1) {
            let addressing: Addressing = this.mode.getAddressing(context);
            let pc: number = addressing.toLow();
            context.registers.pc.set(pc);

            return this.cycle;
        }
        return this.cycle;
    }

}

class BVC extends Operation {
    public name: string = "BVC";

    public execute(context: OpContext): number {
        if (context.registers.p.getV() == 0) {
            let addressing: Addressing = this.mode.getAddressing(context);
            let pc: number = addressing.toLow();
            context.registers.pc.set(pc);

            return this.cycle;
        }
        return this.cycle;
    }

}

class BRL extends Operation {
    public name: string = "BRL";

    public execute(context: OpContext): number {
        let addressing: Addressing = this.mode.getAddressing(context);
        let pc: number = addressing.toLow();
        context.registers.pc.set(pc);

        return this.cycle;
    }

}

class DEC extends Operation {
    public name: string = "DEC";

    public execute(context: OpContext): number {
        let address: Addressing = this.mode.getAddressing(context);
        let is8Bit: boolean = context.registers.p.getM() == 1;
        let mask: number = is8Bit ? 0xFF : 0xFFFF;
        let isAcc: boolean = this.mode == AddressingModes.accumulator;

        if (isAcc) {
            let data: number = context.registers.a.getC() & mask;
            let value: number = (data - 1) & mask;

            if (is8Bit) context.registers.a.setA(value);
            if (!is8Bit) context.registers.a.setC(value);

            context.setFlagN(value, is8Bit);
            context.setFlagZ(value, is8Bit);
        } else {
            if (is8Bit) {
                let loData: number = context.bus.readByte(address.toLow());
                let value: number = (loData - 1) & mask;

                context.bus.writeByte(address.toLow(), value & 0xFF);

                context.setFlagN(value, is8Bit);
                context.setFlagZ(value, is8Bit);
            } else {
                let loData: number = context.bus.readByte(address.toLow());
                let hiData: number = context.bus.readByte(address.toHigh());
                let value: number = (Bit.toUint16(hiData, loData) - 1) & mask;

                context.bus.writeByte(address.toHigh(), Bit.getUint16Upper(value) & 0xFFFF);
                context.bus.writeByte(address.toLow(), Bit.getUint16Lower(value) & 0xFFFF);

                context.setFlagN(value, is8Bit);
                context.setFlagZ(value, is8Bit);
            }
        }
        return this.cycle;
    }

}

class DEX extends Operation {
    public name: string = "DEX";

    public execute(context: OpContext): number {
        let is8Bit: boolean = context.registers.p.getX() == 1;
        let mask: number = is8Bit ? 0xFF : 0xFFFF;
        let value: number = (context.registers.x.get() - 1) & mask;

        context.setFlagN(value, is8Bit);
        context.setFlagZ(value, is8Bit);

        if (is8Bit) context.registers.x.setXL(value);
        if (!is8Bit) context.registers.x.set(value);

        return this.cycle;
    }

}

class DEY extends Operation {
    public name: string = "DEY";

    public execute(context: OpContext): number {
        let is8Bit: boolean = context.registers.p.getX() == 1;
        let mask: number = is8Bit ? 0xFF : 0xFFFF;
        let value: number = (context.registers.y.get() - 1) & mask;

        context.setFlagN(value, is8Bit);
        context.setFlagZ(value, is8Bit);

        if (is8Bit) context.registers.y.setYL(value);
        if (!is8Bit) context.registers.y.set(value);

        return this.cycle;
    }

}

class EOR extends Operation {
    public name: string = "EOR";

    public execute(context: OpContext): number {
        let is8Bit: boolean = context.registers.p.getM() == 1;
        let mask: number = is8Bit ? 0xFF : 0xFFFF;

        let a: number = context.registers.a.get() & mask;
        let data: number = this.mode.getValue(context) & mask;
        let result: number = (a ^ data) & mask;

        if (is8Bit) context.registers.a.setA(result);
        if (!is8Bit) context.registers.a.setC(result);

        context.setFlagN(result, is8Bit);
        context.setFlagZ(result, is8Bit);

        return this.cycle;
    }

    public getSize(): number {
        let isImmediate: boolean = this.mode == AddressingModes.immediateM;
        if (isImmediate && this.cpu.registers.p.getM() == 1) {
            return super.getSize() - 1;
        }
        return super.getSize();
    }
}

class INC extends Operation {
    public name: string = "INC";

    public execute(context: OpContext): number {
        let address: Addressing = this.mode.getAddressing(context);
        let is8Bit: boolean = context.registers.p.getM() == 1;
        let mask: number = is8Bit ? 0xFF : 0xFFFF;
        let isAcc: boolean = this.mode == AddressingModes.accumulator;
        if (isAcc) {
            let data: number = context.registers.a.getC() & mask;
            let value: number = (data + 1) & mask;

            if (is8Bit) context.registers.a.setA(value);
            if (!is8Bit) context.registers.a.setC(value);

            context.setFlagN(value, is8Bit);
            context.setFlagZ(value, is8Bit);
        } else {
            if (is8Bit) {
                let loData: number = context.bus.readByte(address.toLow());
                let value: number = (loData + 1) & mask;

                context.bus.writeByte(address.toLow(), value & 0xFF);

                context.setFlagN(value, is8Bit);
                context.setFlagZ(value, is8Bit);
            } else {
                let loData: number = context.bus.readByte(address.toLow());
                let hiData: number = context.bus.readByte(address.toHigh());
                let value: number = (Bit.toUint16(hiData, loData) + 1) & mask;

                context.bus.writeByte(address.toLow(), Bit.getUint16Lower(value) & 0xFF);
                context.bus.writeByte(address.toHigh(), Bit.getUint16Upper(value) & 0xFF);

                context.setFlagN(value, is8Bit);
                context.setFlagZ(value, is8Bit);
            }
        }
        return this.cycle;
    }

}

class INX extends Operation {
    public name: string = "INX";

    public execute(context: OpContext): number {
        let is8Bit: boolean = context.registers.p.getX() == 1;
        let mask: number = is8Bit ? 0xFF : 0xFFFF;
        let value: number = (context.registers.x.get() + 1) & mask;

        context.setFlagN(value, is8Bit);
        context.setFlagZ(value, is8Bit);

        if (is8Bit) context.registers.x.setXL(value & 0xFF);
        if (!is8Bit) context.registers.x.set(value & 0xFFFF);

        return this.cycle;
    }

}

class INY extends Operation {
    public name: string = "INY";

    public execute(context: OpContext): number {

        let is8Bit: boolean = context.registers.p.getX() == 1;
        let mask: number = is8Bit ? 0xFF : 0xFFFF;
        let value: number = (context.registers.y.get() + 1) & mask;

        context.setFlagN(value, is8Bit);
        context.setFlagZ(value, is8Bit);

        if (is8Bit) context.registers.y.setYL(value);
        if (!is8Bit) context.registers.y.set(value);

        return this.cycle;
    }

}

class XCE extends Operation {
    public name: string = "XCE";

    public execute(context: OpContext): number {
        let c: number = context.registers.p.getC();
        let e: number = context.registers.p.getE();

        context.registers.p.setE(c);
        context.registers.p.setC(e);

        if (c == 0x1) {
            context.registers.sp.setSH(0x01);
            context.registers.x.setXH(0x00);
            context.registers.y.setYH(0x00);
            context.registers.p.setM(1);
            context.registers.p.setX(1);
        }

        return this.cycle;
    }

}

class XBA extends Operation {
    public name: string = "XBA";

    public execute(context: OpContext): number {
        let hi: number = context.registers.a.getB();
        let lo: number = context.registers.a.getA();
        let is8Bit: boolean = true;

        let value: number = Bit.toUint16(lo, hi);
        context.registers.a.setC(value);

        context.setFlagN(hi, is8Bit);
        context.setFlagZ(hi, is8Bit);

        return this.cycle;
    }
}

class WDM extends Operation {
    public name: string = "WDM";

    public execute(context: OpContext): number {
        return this.cycle;
    }

}

class WAI extends Operation {
    public name: string = "WAI";

    public execute(context: OpContext): number {
        const isInterruptsDisabled = context.cpu.registers.p.getI() == 1;
        if (isInterruptsDisabled) return this.cycle;

        context.cpu.interrupts.wait = true;
        return this.cycle;
    }

}

class TYX extends Operation {
    public name: string = "TYX";

    public execute(context: OpContext): number {
        let y: number = context.cpu.registers.y.get();
        let is8Bit: boolean = context.registers.p.getX() == 1;
        let mask: number = is8Bit ? 0xFF: 0xFFFF;

        let value = y & mask;

        context.setFlagN(value, is8Bit);
        context.setFlagZ(value, is8Bit);

        if (is8Bit) {
            context.cpu.registers.x.setXL(value);
        } else {
            context.cpu.registers.x.set(value);
        }
        return this.cycle;
    }
}

class TYA extends Operation {
    public name: string = "TYA";

    public execute(context: OpContext): number {
        let y: number = context.cpu.registers.y.get();
        let is8Bit: boolean = context.registers.p.getM() == 1;
        let mask: number = is8Bit ? 0xFF: 0xFFFF;

        let value = y & mask;

        context.setFlagN(value, is8Bit);
        context.setFlagZ(value, is8Bit);

        if (is8Bit) {
            context.cpu.registers.a.setA(value);
        } else {
            context.cpu.registers.a.setC(value);
        }
        return this.cycle;
    }
}

class TXY extends Operation {
    public name: string = "TXY";

    public execute(context: OpContext): number {
        let x: number = context.cpu.registers.x.get();
        let is8Bit: boolean = context.registers.p.getX() == 1;
        let mask: number = is8Bit ? 0xFF: 0xFFFF;

        let value = x & mask;

        context.setFlagN(value, is8Bit);
        context.setFlagZ(value, is8Bit);

        if (is8Bit) {
            context.cpu.registers.y.setYL(value);
        } else {
            context.cpu.registers.y.set(value);
        }
        return this.cycle;
    }

}

class TAX extends Operation {
    public name: string = "TAX";

    public execute(context: OpContext): number {
        let a: number = context.cpu.registers.a.get();
        let is8Bit: boolean = context.registers.p.getX() == 1;
        let mask: number = is8Bit ? 0xFF: 0xFFFF;

        let value = a & mask;

        context.setFlagN(value, is8Bit);
        context.setFlagZ(value, is8Bit);

        if (is8Bit) {
            context.cpu.registers.x.setXL(value);
        } else {
            context.cpu.registers.x.set(value);
        }
        return this.cycle;
    }

}

class TAY extends Operation {
    public name: string = "TAY";

    public execute(context: OpContext): number {
        let a: number = context.cpu.registers.a.get();
        let is8Bit: boolean = context.registers.p.getX() == 1;
        let mask: number = is8Bit ? 0xFF: 0xFFFF;

        let value = a & mask;

        context.setFlagN(value, is8Bit);
        context.setFlagZ(value, is8Bit);

        if (is8Bit) {
            context.cpu.registers.y.setYL(value);
        } else {
            context.cpu.registers.y.set(value);
        }
        return this.cycle;
    }
}

class TCD extends Operation {
    public name: string = "TCD";

    public execute(context: OpContext): number {
        let a: number = context.cpu.registers.a.get();
        let is8Bit: boolean = false;

        context.setFlagN(a, is8Bit);
        context.setFlagZ(a, is8Bit);

        context.cpu.registers.d.set(a);
        return this.cycle;
    }

}

class TCS extends Operation {
    public name: string = "TCS";

    public execute(context: OpContext): number {
        let value: number = context.registers.a.get();
        context.registers.sp.set(value);
        return this.cycle;
    }

}

class TDC extends Operation {
    public name: string = "TDC";

    public execute(context: OpContext): number {
        let d: number = context.registers.d.get();
        let is8Bit: boolean = false;

        context.setFlagN(d, is8Bit);
        context.setFlagZ(d, is8Bit);

        context.registers.a.setC(d);

        return this.cycle;
    }

}

class TRB extends Operation {
    public name: string = "TRB";

    public execute(context: OpContext): number {
        let addressing: Addressing = this.mode.getAddressing(context);
        let is8Bit: boolean = context.cpu.registers.p.getM() == 1;
        let mask: number = is8Bit ? 0xFF : 0xFFFF;

        let a: number = context.registers.a.get() & mask;

        let lowData: number = context.bus.readByte(addressing.toLow());
        let highData: number = !is8Bit ? context.bus.readByte(addressing.toHigh()): 0;
        let data: number = Bit.toUint16(highData, lowData) & mask;

        let value: number = (data ^ (data & a)) & mask;
        context.setFlagZ(data & a, is8Bit);

        context.bus.writeByte(addressing.toLow(), Bit.getUint16Lower(value));
        if (!is8Bit) context.bus.writeByte(addressing.toHigh(), Bit.getUint16Upper(value));
        return this.cycle;
    }

}

class TXS extends Operation {
    public name: string = "TXS";

    public execute(context: OpContext): number {
        let is8Bit: boolean = context.cpu.registers.p.getE() == 1;
        let data = context.cpu.registers.x.get();
        let mask = is8Bit ? 0xFF : 0xFFFF;
        if (is8Bit) context.cpu.registers.sp.setSL(data & mask);
        if (!is8Bit) context.cpu.registers.sp.set(data);
        return this.cycle;
    }
}

class TSB extends Operation {
    public name: string = "TSB";

    public execute(context: OpContext): number {
        let addressing: Addressing = this.mode.getAddressing(context);
        let is8Bit: boolean = context.cpu.registers.p.getM() == 1;
        let mask: number = is8Bit ? 0xFF : 0xFFFF;

        let a: number = context.registers.a.get() & mask;

        let lowData: number = context.bus.readByte(addressing.toLow());
        let highData: number = !is8Bit ? context.bus.readByte(addressing.toHigh()): 0;
        let data: number = Bit.toUint16(highData, lowData) & mask;

        let value: number = (data | a) & mask;
        context.setFlagZ(data & a, is8Bit);

        context.bus.writeByte(addressing.toLow(), Bit.getUint16Lower(value));
        if (!is8Bit) context.bus.writeByte(addressing.toHigh(), Bit.getUint16Upper(value));
        return this.cycle;
    }

}

class TXA extends Operation {

    public name: string = "TXA";

    public execute(context: OpContext): number {
        let x: number = context.cpu.registers.x.get();
        let is8Bit: boolean = context.registers.p.getM() == 1;
        let mask: number = is8Bit ? 0xFF: 0xFFFF;

        let value = x & mask;

        context.setFlagN(value, is8Bit);
        context.setFlagZ(value, is8Bit);

        if (is8Bit) {
            context.cpu.registers.a.setA(value);
        } else {
            context.cpu.registers.a.setC(value);
        }
        return this.cycle;
    }
}

class TSX extends Operation {
    public name: string = "TSX";

    public execute(context: OpContext): number {
        let is8Bit: boolean = context.cpu.registers.p.getX() == 1;
        let mask = is8Bit ? 0xFF : 0xFFFF;
        let value = context.cpu.registers.sp.get() & mask;

        if (is8Bit) context.cpu.registers.x.setXL(value);
        if (!is8Bit) context.cpu.registers.x.set(value);

        context.setFlagN(value, is8Bit);
        context.setFlagZ(value, is8Bit);

        return this.cycle;
    }

}

class TSC extends Operation {
    public name: string = "TSC";

    public execute(context: OpContext): number {
        let is8Bit: boolean = false;
        let value: number = context.cpu.registers.sp.get();
        context.cpu.registers.a.setC(value);

        context.setFlagN(value, is8Bit);
        context.setFlagZ(value, is8Bit);

        return this.cycle;
    }

}

class STZ extends Operation {
    public name: string = "STZ";

    public execute(context: OpContext): number {
        let addresses: Addressing = this.mode.getAddressing(context);
        let is8Bit: boolean = context.registers.p.getM() == 1;

        let loAddr: number = addresses.toLow();
        let hiAddr: number = addresses.toHigh();

        context.bus.writeByte(loAddr, 0);
        if (!is8Bit) context.bus.writeByte(hiAddr, 0);

        return this.cycle;
    }

}

class JMP extends Operation {
    public name: string = "JMP";

    public execute(context: OpContext): number {
        let addressing: Addressing = this.mode.getAddressing(context);
        let address: number = addressing.toLow();

        context.registers.pc.set(AddressUtil.getPage(address));
        context.registers.k.set(AddressUtil.getBank(address));

        return this.cycle;
    }

}

class JSL extends Operation {
    public name: string = "JSL";

    public execute(context: OpContext): number {
        let bank: number = (context.registers.k.get()) & 0xFF;
        let pc: number = (context.registers.pc.get() - 1) & 0xFFFF;
        let addressing: Addressing = this.mode.getAddressing(context);
        let address: number = addressing.toLow();

        context.cpu.stack.pushByte(bank);
        context.cpu.stack.pushWord(pc);
        context.registers.pc.set(AddressUtil.getPage(address));
        context.registers.k.set(AddressUtil.getBank(address));

        return this.cycle;
    }

}


class JSR extends Operation {
    public name: string = "JSR";

    public execute(context: OpContext): number {
        let pc: number = (context.registers.pc.get() - 1) & 0xFFFF;
        let addressing: Addressing = this.mode.getAddressing(context);
        let address: number = addressing.toLow();

        context.cpu.stack.pushWord(pc);
        context.registers.pc.set(AddressUtil.getPage(address));

        return this.cycle;
    }

}

class LDA extends Operation {
    public name: string = "LDA";

    public execute(context: OpContext): number {
        let addressing: Addressing = this.mode.getAddressing(context);
        let is8Bit: boolean = context.registers.p.getM() == 1;

        let loAddr: number = addressing.toLow();
        let hiAddr: number = addressing.toHigh();

        let loData: number = context.bus.readByte(loAddr);
        let hiData: number = is8Bit ? 0 : context.bus.readByte(hiAddr);

        let value: number = Bit.toUint16(hiData, loData);

        if (is8Bit) context.registers.a.setA(value);
        if (!is8Bit) context.registers.a.setC(value);

        context.setFlagZ(value, is8Bit);
        context.setFlagN(value, is8Bit);

        return this.cycle;
    }

    public getSize(): number {
        let isImmediate: boolean = this.mode == AddressingModes.immediateM;
        if (isImmediate && this.cpu.registers.p.getM() == 1) {
            return super.getSize() - 1;
        }
        return super.getSize();
    }
}

class LDX extends Operation {
    public name: string = "LDX";

    public execute(context: OpContext): number {
        let addressing: Addressing = this.mode.getAddressing(context);
        let is8Bit: boolean = context.registers.p.getX() == 1;

        let loAddr: number = addressing.toLow();
        let hiAddr: number = addressing.toHigh();

        let loData: number = context.bus.readByte(loAddr);
        let hiData: number = is8Bit ? 0 : context.bus.readByte(hiAddr);

        let value: number = Bit.toUint16(hiData, loData);

        if (is8Bit) context.registers.x.setXL(value);
        if (!is8Bit) context.registers.x.set(value);

        context.setFlagZ(value, is8Bit);
        context.setFlagN(value, is8Bit);

        return this.cycle;
    }

    public getSize(): number {
        let isImmediate: boolean = this.mode == AddressingModes.immediateX;
        if (isImmediate && this.cpu.registers.p.getX() == 1) {
            return super.getSize() - 1;
        }
        return super.getSize();
    }
}

class LDY extends Operation {
    public name: string = "LDY";

    public execute(context: OpContext): number {
        let addressing: Addressing = this.mode.getAddressing(context);
        let is8Bit: boolean = context.registers.p.getX() == 1;

        let loAddr: number = addressing.toLow();
        let hiAddr: number = addressing.toHigh();

        let loData: number = context.bus.readByte(loAddr);
        let hiData: number = is8Bit ? 0 : context.bus.readByte(hiAddr);

        let value: number = Bit.toUint16(hiData, loData);

        if (is8Bit) context.registers.y.setYL(value);
        if (!is8Bit) context.registers.y.set(value);

        context.setFlagZ(value, is8Bit);
        context.setFlagN(value, is8Bit);

        return this.cycle;
    }

    public getSize(): number {
        let isImmediate: boolean = this.mode == AddressingModes.immediateX;
        if (isImmediate && this.cpu.registers.p.getX() == 1) {
            return super.getSize() - 1;
        }
        return super.getSize();
    }
}

class LSR extends Operation {
    public name: string = "LSR";

    public execute(context: OpContext): number {
        let isAccMode: boolean = this.mode == AddressingModes.accumulator;
        let is8Bit: boolean = this.cpu.registers.p.getM() == 1;
        let mask: number = is8Bit ? 0xFF : 0xFFFF;

        let data = this.mode.getValue(context) & mask;
        let result: number = (data >> 1) & mask;

        if (isAccMode) {
            if (is8Bit) this.cpu.registers.a.setA(result);
            if (!is8Bit) this.cpu.registers.a.setC(result);
        } else {
            let addressing: Addressing = this.mode.getAddressing(context);
            let loData: number = Bit.getUint16Lower(result) & 0xFF;
            let hiData: number = Bit.getUint16Upper(result) & 0xFF;

            context.bus.writeByte(addressing.toLow(), loData);
            if (!is8Bit) context.bus.writeByte(addressing.toHigh(), hiData);
        }

        context.setFlagN(result, is8Bit);
        context.setFlagZ(result, is8Bit);
        this.cpu.registers.p.setC(data & 0x1);

        return this.cycle;
    }

}

class MVN extends Operation {
    public name: string = "MVN";

    public execute(context: OpContext): number {
        let addressing: Addressing = this.mode.getAddressing(context);
        let amount: number = context.registers.a.get() & 0xFFFF;

        let srcBank: number = AddressUtil.getBank(addressing.toLow());
        let srcPage: number = AddressUtil.getPage(addressing.toLow());

        let destBank: number = AddressUtil.getBank(addressing.toHigh());
        let destPage: number = AddressUtil.getPage(addressing.toHigh());

        let counter = 0;
        while (amount != 0xFFFF) {
            let src: number = AddressUtil.create(srcPage, srcBank);
            let dest: number = AddressUtil.create(destPage, destBank);

            let val : number = context.bus.readByte(src);
            context.bus.writeByte(dest, val);

            srcPage = ((srcPage + 1) % 0x10000) & 0xFFFF;
            destPage = ((destPage + 1) % 0x10000) & 0xFFFF;
            amount = (amount - 1) & 0xFFFF;
            counter++;
        }

        this.cpu.registers.x.set((this.cpu.registers.x.get() + counter) & 0xFFFF);
        this.cpu.registers.y.set((this.cpu.registers.y.get() + counter) & 0xFFFF);
        this.cpu.registers.dbr.set(destBank);
        this.cpu.registers.a.setC(0xFFFF);

        return this.cycle;
    }
}

class MVP extends Operation {
    public name: string = "MVP";

    public execute(context: OpContext): number {
        let addressing: Addressing = this.mode.getAddressing(context);
        let amount: number = context.registers.a.get() & 0xFFFF;

        let srcBank: number = AddressUtil.getBank(addressing.toLow());
        let srcPage: number = AddressUtil.getPage(addressing.toLow());

        let destBank: number = AddressUtil.getBank(addressing.toHigh());
        let destPage: number = AddressUtil.getPage(addressing.toHigh());

        let counter = 0;
        while (amount != 0xFFFF) {
            let src: number = AddressUtil.create(srcPage, srcBank);
            let dest: number = AddressUtil.create(destPage, destBank);

            let val : number = context.bus.readByte(src);
            context.bus.writeByte(dest, val);

            srcPage = ((srcPage - 1) % 0x10000) & 0xFFFF;
            destPage = ((destPage - 1) % 0x10000) & 0xFFFF;
            amount = (amount - 1) & 0xFFFF;
            counter++;
        }

        this.cpu.registers.x.set((this.cpu.registers.x.get() - amount) & 0xFFFF);
        this.cpu.registers.y.set((this.cpu.registers.y.get() - amount) & 0xFFFF);
        this.cpu.registers.dbr.set(destBank);
        this.cpu.registers.a.setC(0xFFFF);

        return this.cycle;
    }
}

class NOP extends Operation {
    public name: string = "NOP";

    public execute(context: OpContext): number {
        return this.cycle;
    }

}

class ORA extends Operation {
    public name: string = "ORA";

    public execute(context: OpContext): number {
        let addressing: Addressing = this.mode.getAddressing(context);
        let is8Bit: boolean = context.registers.p.getM() == 1;
        let mask: number = is8Bit ? 0xFF : 0xFFFF;

        let loData: number = context.bus.readByte(addressing.toLow());
        let hiData: number = is8Bit ? 0 : context.bus.readByte(addressing.toHigh());

        let data: number = Bit.toUint16(hiData, loData) & mask;
        let a: number = context.registers.a.get() & mask;

        let result: number = (data | a) & mask;

        context.setFlagN(result, is8Bit);
        context.setFlagZ(result, is8Bit);

        if (is8Bit) {
            context.registers.a.setA(result);
        } else {
            context.registers.a.setC(result);
        }

        return this.cycle;
    }

    public getSize(): number {
        let isImmediate: boolean = this.mode == AddressingModes.immediateM;
        if (isImmediate && this.cpu.registers.p.getM() == 1) {
            return super.getSize() - 1;
        }
        return super.getSize();
    }
}

class PEA extends Operation {
    public name: string = "PEA";

    public execute(context: OpContext): number {
        let value: number = this.mode.getValue(context);
        context.cpu.stack.pushWord(value);

        return this.cycle;
    }
}

class PEI extends Operation {
    public name: string = "PEI";

    public execute(context: OpContext): number {
        let value = this.mode.getValue(context);
        context.cpu.stack.pushWord(value);

        return this.cycle;
    }

}

class PER extends Operation {
    public name: string = "PER";

    public execute(context: OpContext): number {
        let address = context.getOperandAddress(2);
        let value = this.mode.getValue(context);
        context.cpu.stack.pushWord((address + value) & 0xFFFF);

        return this.cycle;
    }
}

class PHA extends Operation {
    public name: string = "PHA";

    public execute(context: OpContext): number {
        let is8Bit: boolean = context.registers.p.getM() == 1;
        if (is8Bit) {
            let result: number = context.cpu.registers.a.getA();
            context.cpu.stack.pushByte(result);
        } else {
            let result: number = context.cpu.registers.a.get();
            context.cpu.stack.pushWord(result);
        }

        return this.cycle;
    }
}

class PHB extends Operation {
    public name: string = "PHB";

    public execute(context: OpContext): number {
        let result: number = context.cpu.registers.dbr.get();

        context.cpu.stack.pushByte(result);

        return this.cycle;
    }

}

class SBC extends Operation {
    public name: string = "SBC";

    public execute(context: OpContext): number {
        let is8Bit: boolean = context.registers.p.getM() == 1;
        let isBcdMode: boolean = context.registers.p.getD() == 1;
        let mask: number = is8Bit ? 0xFF : 0xFFFF;
        let size: number = is8Bit ? 0x80 : 0x8000;
        let overflow: number = is8Bit ? 0x100 : 0x10000;

        let a: number = context.cpu.registers.a.get() & mask;
        let b: number = this.mode.getValue(context) & mask;
        let c: number = context.cpu.registers.p.getC();

        b ^= mask;
        let result: number = 0;
        if (isBcdMode) {
            let an0 = a & 0x000f;
            let an1 = a & 0x00f0;
            let an2 = a & 0x0f00;
            let an3 = a & 0xf000;

            let bn0 = b & 0x000f;
            let bn1 = b & 0x00f0;
            let bn2 = b & 0x0f00;
            let bn3 = b & 0xf000;

            an0 = an0 + c;

            an0 = an0 + bn0;
            an1 = an1 + bn1;
            an2 = an2 + bn2;
            an3 = an3 + bn3;

            if (an0 < 0x0010) an0 = an0 - 0x0006;
            if (an0 > 0x000f) an1 = an1 + 0x0010;
            an0 = an0 & 0x000f;

            if (!is8Bit) {
                if (an1 < 0x0100) an1 = an1 - 0x0060;
                if (an1 > 0x00ff) an2 = an2 + 0x0100;
                an1 = an1 & 0x00f0;

                if (an2 < 0x1000) an2 = an2 - 0x0600;
                if (an2 > 0x0fff) an3 = an3 + 0x1000;
                an2 = an2 & 0x0f00;
            }

            result = an0 + an1 + an2 + an3;
            context.registers.p.setV((~(a ^ b) & (a ^ result) & size) != 0 ? 1 : 0);
            if (result < overflow) result = result - (is8Bit ? 0x60 : 0x6000);
        } else {
            result = a + b + c;
            context.registers.p.setV((~(a ^ b) & (a ^ result) & size) != 0 ? 1 : 0);
        }

        context.registers.p.setC(result > mask ? 1: 0);
        result &= mask;

        if (is8Bit) context.registers.a.setA(result);
        if (!is8Bit) context.registers.a.setC(result);

        context.setFlagN(result, is8Bit);
        context.setFlagZ(result, is8Bit);

        return this.cycle;
    }

    public getSize(): number {
        let isImmediate: boolean = this.mode == AddressingModes.immediateM;
        if (isImmediate && this.cpu.registers.p.getM() == 1) {
            return super.getSize() - 1;
        }
        return super.getSize();
    }

}

class STA extends Operation {
    public name: string = "STA";

    public execute(context: OpContext): number {
        let is8Bit: boolean = context.registers.p.getM() == 1;
        let loData: number = context.cpu.registers.a.getA();
        let hiData: number = context.cpu.registers.a.getB();

        let addresses: Addressing = this.mode.getAddressing(context);
        let loAddr: number = addresses.toLow();
        let hiAddr: number = addresses.toHigh();

        context.bus.writeByte(loAddr, loData);
        if (!is8Bit)
            context.bus.writeByte(hiAddr, hiData);

        return this.cycle;
    }
}

class ROL extends Operation {
    public name: string = "ROL";

    public execute(context: OpContext): number {
        let addressing: Addressing = this.mode.getAddressing(context);
        let is8Bit: boolean = context.registers.p.getM() == 1;
        let c: number = context.registers.p.getC();
        let shift: number = is8Bit ? 7 : 15;
        let mask: number = is8Bit ? 0xFF : 0xFFFF;
        let isAcc: boolean = this.mode == AddressingModes.accumulator;

        if (isAcc) {
            let data: number = context.registers.a.getC() & mask;
            let value: number = ((data << 1) & mask) | c;

            context.registers.p.setC(((data >> shift) & 0x1) != 0 ? 1 : 0);
            context.setFlagN(value, is8Bit);
            context.setFlagZ(value, is8Bit);

            let lowVal: number = Bit.getUint16Lower(value);
            let highVal: number = Bit.getUint16Upper(value);

            context.registers.a.setA(lowVal);
            if (!is8Bit) context.registers.a.setB(highVal);
        } else {
            let loData: number = context.bus.readByte(addressing.toLow());
            let hiData: number = is8Bit ? 0 : context.bus.readByte(addressing.toHigh());

            let data: number = Bit.toUint16(hiData, loData) & mask;
            let value: number = ((data << 1) & mask) | c;

            context.registers.p.setC(((data >> shift) & 0x1) != 0 ? 1 : 0);
            context.setFlagN(value, is8Bit);
            context.setFlagZ(value, is8Bit);

            let lowVal: number = Bit.getUint16Lower(value);
            let highVal: number = Bit.getUint16Upper(value);

            context.bus.writeByte(addressing.toLow(), lowVal);
            if (!is8Bit) context.bus.writeByte(addressing.toHigh(), highVal);
        }

        return this.cycle;
    }

}

class ROR extends Operation {
    public name: string = "ROR";

    public execute(context: OpContext): number {
        let addressing: Addressing = this.mode.getAddressing(context);
        let is8Bit: boolean = context.registers.p.getM() == 1;
        let c: number = context.registers.p.getC();
        let shift: number = is8Bit ? 7 : 15;
        let mask: number = is8Bit ? 0xFF : 0xFFFF;
        let isAcc: boolean = this.mode == AddressingModes.accumulator;

        if (isAcc) {
            let data: number = context.registers.a.getC() & mask;
            let value: number = ((data >> 1) & mask) | (c << shift);

            context.registers.p.setC(((data >> 0) & 0x1) != 0 ? 1 : 0);
            context.setFlagN(value, is8Bit);
            context.setFlagZ(value, is8Bit);

            let lowVal: number = Bit.getUint16Lower(value);
            let highVal: number = Bit.getUint16Upper(value);

            context.registers.a.setA(lowVal);
            if (!is8Bit) context.registers.a.setB(highVal);
        } else {
            let loData: number = context.bus.readByte(addressing.toLow());
            let hiData: number = is8Bit ? 0 : context.bus.readByte(addressing.toHigh());

            let data: number = Bit.toUint16(hiData, loData) & mask;
            let value: number = ((data >> 1) & mask) | (c << shift);

            context.registers.p.setC(((data >> 0) & 0x1) != 0 ? 1 : 0);
            context.setFlagN(value, is8Bit);
            context.setFlagZ(value, is8Bit);

            let lowVal: number = Bit.getUint16Lower(value);
            let highVal: number = Bit.getUint16Upper(value);

            context.bus.writeByte(addressing.toLow(), lowVal);
            if (!is8Bit) context.bus.writeByte(addressing.toHigh(), highVal);
        }

        return this.cycle;
    }
}

class STY extends Operation {
    public name: string = "STY";

    public execute(context: OpContext): number {
        let loData: number = context.cpu.registers.y.getYL();
        let hiData: number = context.cpu.registers.y.getYH();
        let is8Bit: boolean = context.registers.p.getX() == 1;

        let addresses: Addressing = this.mode.getAddressing(context);

        let loAddr: number = addresses.toLow();
        let hiAddr: number = addresses.toHigh();

        context.bus.writeByte(loAddr, loData);
        if (!is8Bit) context.bus.writeByte(hiAddr, hiData);

        return this.cycle;
    }
}

class PHD extends Operation {

    public name: string = "PHD";

    public execute(context: OpContext): number {
        let result: number = context.cpu.registers.d.get();

        context.cpu.stack.pushWord(result);

        return this.cycle;
    }

}

class PHK extends Operation {

    public name: string = "PHK";

    public execute(context: OpContext): number {
        let result: number = context.cpu.registers.k.get();

        context.cpu.stack.pushByte(result);

        return this.cycle;
    }

}

class PHP extends Operation {
    public name: string = "PHP";

    public execute(context: OpContext): number {
        let p: number = context.registers.p.get();

        context.cpu.stack.pushByte(p);

        return this.cycle;
    }

}

class PHX extends Operation {
    public name: string = "PHX";

    public execute(context: OpContext): number {
        let is8Bit: boolean = context.registers.p.getX() == 1;
        let data: number = context.registers.x.get();

        if (is8Bit) {
            context.cpu.stack.pushByte(data & 0xFF);
        } else {
            context.cpu.stack.pushWord(data);
        }

        return this.cycle;
    }

}

class PHY extends Operation {
    public name: string = "PHY";

    public execute(context: OpContext): number {
        let is8Bit: boolean = context.registers.p.getX() == 1;
        let data: number = context.registers.y.get();

        if (is8Bit) {
            context.cpu.stack.pushByte(data & 0xFF);
        } else {
            context.cpu.stack.pushWord(data);
        }

        return this.cycle;
    }

}

class PLA extends Operation {
    public name: string = "PLA";

    public execute(context: OpContext): number {
        let is8Bit: boolean = context.registers.p.getM() == 1;
        let data: number = is8Bit ? context.cpu.stack.popByte() : context.cpu.stack.popWord();

        if (is8Bit) context.registers.a.setA(data);
        if (!is8Bit) context.registers.a.setC(data);

        context.setFlagN(data, is8Bit);
        context.setFlagZ(data, is8Bit);
        return this.cycle;
    }

    public getSize(): number {
        let isImmediate: boolean = this.mode == AddressingModes.immediateM;
        if (isImmediate && this.cpu.registers.p.getM() == 1) {
            return super.getSize() - 1;
        }
        return super.getSize();
    }
}

class PLB extends Operation {
    public name: string = "PLB";

    public execute(context: OpContext): number {
        let is8Bit: boolean = true;
        let value: number = context.cpu.stack.popByte();

        context.registers.dbr.set(value);
        context.setFlagN(value, is8Bit);
        context.setFlagZ(value, is8Bit);
        return this.cycle;
    }

}

class PLD extends Operation {
    public name: string = "PLD";

    public execute(context: OpContext): number {
        let is8Bit: boolean = true;
        let value: number = context.cpu.stack.popWord();

        context.registers.d.set(value);
        context.setFlagN(value, is8Bit);
        context.setFlagZ(value, is8Bit);
        return this.cycle;
    }
}

class PLP extends Operation {
    public name: string = "PLP";

    public execute(context: OpContext): number {
        let is8Bit: boolean = context.registers.p.getE() == 1;
        let p: number = context.cpu.stack.popByte();

        context.registers.p.set(p);

        if (is8Bit) {
            context.registers.p.setX(1);
            context.registers.p.setM(1);
        }

        return this.cycle;
    }

}

class PLX extends Operation {
    public name: string = "PLX";

    public execute(context: OpContext): number {
        let is8Bit: boolean = context.registers.p.getX() == 1;
        let data: number = is8Bit ? context.cpu.stack.popByte() : context.cpu.stack.popWord();

        context.setFlagN(data, is8Bit);
        context.setFlagZ(data, is8Bit);

        if (is8Bit) context.registers.x.setXL(data);
        if (!is8Bit) context.registers.x.set(data);

        return this.cycle;
    }

}

class PLY extends Operation {
    public name: string = "PLY";

    public execute(context: OpContext): number {
        let is8Bit: boolean = context.registers.p.getX() == 1;
        let data: number = is8Bit ? context.cpu.stack.popByte() : context.cpu.stack.popWord();

        context.setFlagN(data, is8Bit);
        context.setFlagZ(data, is8Bit);

        if (is8Bit) context.registers.y.setYL(data);
        if (!is8Bit) context.registers.y.set(data);

        return this.cycle;
    }
}

class REP extends Operation {
    public name: string = "REP";

    public execute(context: OpContext): number {
        let xFlag = context.registers.p.getX() == 1;
        let p: number = context.registers.p.get();
        let data: number = this.mode.getValue(context);

        let result: number = p & (~data>>>0 & 0xFF);
        context.registers.p.set(result);

        if (context.registers.p.getE() == 0) {
            if (context.registers.p.getX() == 1) {
                context.registers.x.setXH(0x00);
                context.registers.y.setYH(0x00);
            }
        }

        return this.cycle;
    }

}

class STX extends Operation {
    public name: string = "STX";

    public execute(context: OpContext): number {
        let loData: number = context.cpu.registers.x.getXL();
        let hiData: number = context.cpu.registers.x.getXH();
        let is8Bit: boolean = context.registers.p.getX() == 1;

        let addresses: Addressing = this.mode.getAddressing(context);

        let loAddr: number = addresses.toLow();
        let hiAddr: number = addresses.toHigh();

        context.bus.writeByte(loAddr, loData);
        if (!is8Bit) context.bus.writeByte(hiAddr, hiData);

        return this.cycle;
    }

}

class STP extends Operation {
    public name: string = "STP";

    public execute(context: OpContext): number {
        return this.cycle;
    }
}

class RTI extends Operation {
    public name: string = "RTI";

    public execute(context: OpContext): number {
        let p: number = context.cpu.stack.popByte();
        let pc: number = context.cpu.stack.popWord();

        context.cpu.registers.pc.set(pc & 0xFFFF);
        context.cpu.registers.p.set(p & 0xFF);

        if (context.registers.p.getE() == 0) {
            let pb: number = context.cpu.stack.popByte();
            context.registers.k.set(pb);
        }
        return this.cycle;
    }
}

class RTL extends Operation {
    public name: string = "RTL";

    public execute(context: OpContext): number {
        let pc: number = context.cpu.stack.popWord();
        let pbc: number = context.cpu.stack.popByte();

        context.cpu.registers.pc.set((pc + 1) & 0xFFFF);
        context.cpu.registers.k.set(pbc & 0xFF);

        return this.cycle;
    }

}

class RTS extends Operation {
    public name: string = "RTS";

    public execute(context: OpContext): number {
        let pc: number = context.cpu.stack.popWord();

        context.cpu.registers.pc.set((pc + 1) & 0xFFFF);

        return this.cycle;
    }

}

class SEC extends Operation {
    public name: string = "SEC";

    public execute(context: OpContext): number {
        context.registers.p.setC(1);
        return this.cycle;
    }

}

class SED extends Operation {
    public name: string = "SED";

    public execute(context: OpContext): number {
        context.registers.p.setD(1);
        return this.cycle;
    }

}

class SEI extends Operation {
    public name: string = "SEI";

    public execute(context: OpContext): number {
        context.registers.p.setI(1);
        return this.cycle;
    }

}

class SEP extends Operation {
    public name: string = "SEP";

    public execute(context: OpContext): number {
        let xFlag: boolean = context.registers.p.getX() == 1;
        let value: number = this.mode.getValue(context);
        let status: number = context.registers.p.get();
        let result: number = status | (value & 0xFF);

        context.registers.p.set(result);

        if (context.registers.p.getE() == 0) {
            if (context.registers.p.getX() == 1) {
                context.registers.x.setXH(0x00);
                context.registers.y.setYH(0x00);
            }
        }

        return this.cycle;
    }
}

export class Opcodes {

    private opcodes: Operation[] = new Array<Operation>(256);

    constructor(cpu: Cpu) {

        this.opcodes[0x61] = new ADC(cpu,0x61, 1, 2, AddressingModes.directIndirectIndexed);
        this.opcodes[0x63] = new ADC(cpu,0x63, 4, 2, AddressingModes.stack);
        this.opcodes[0x65] = new ADC(cpu,0x65, 4, 2, AddressingModes.direct);
        this.opcodes[0x67] = new ADC(cpu,0x67, 6, 2, AddressingModes.directIndexedIndirect);
        this.opcodes[0x69] = new ADC(cpu,0x69, 2, 3, AddressingModes.immediateM);
        this.opcodes[0x6D] = new ADC(cpu,0x6D, 4, 3, AddressingModes.absolute);
        this.opcodes[0x6F] = new ADC(cpu,0x6F, 4, 4, AddressingModes.long);
        this.opcodes[0x71] = new ADC(cpu,0x71, 5, 2, AddressingModes.directIndirectLong);
        this.opcodes[0x72] = new ADC(cpu,0x72, 7, 2, AddressingModes.directIndirect);
        this.opcodes[0x73] = new ADC(cpu,0x73, 7, 2, AddressingModes.stackY);
        this.opcodes[0x75] = new ADC(cpu,0x75, 4, 2, AddressingModes.directX);
        this.opcodes[0x77] = new ADC(cpu,0x77, 6, 2, AddressingModes.directIndirectIndexedLong);
        this.opcodes[0x79] = new ADC(cpu,0x79, 4, 3, AddressingModes.absoluteY);
        this.opcodes[0x7D] = new ADC(cpu,0x7D, 4, 3, AddressingModes.absoluteX);
        this.opcodes[0x7F] = new ADC(cpu,0x7F, 5, 4, AddressingModes.longX);

        this.opcodes[0xE1] = new SBC(cpu,0xE1, 6, 2, AddressingModes.directIndirectIndexed);
        this.opcodes[0xE3] = new SBC(cpu,0xE3, 4, 2, AddressingModes.stack);
        this.opcodes[0xE5] = new SBC(cpu,0xE5, 3, 2, AddressingModes.direct);
        this.opcodes[0xE7] = new SBC(cpu,0xE7, 6, 2, AddressingModes.directIndexedIndirect);
        this.opcodes[0xE9] = new SBC(cpu,0xE9, 2, 3, AddressingModes.immediateM);
        this.opcodes[0xED] = new SBC(cpu,0xED, 4, 3, AddressingModes.absolute);
        this.opcodes[0xEF] = new SBC(cpu,0xEF, 5, 4, AddressingModes.long);
        this.opcodes[0xF1] = new SBC(cpu,0xF1, 5, 2, AddressingModes.directIndirectLong);
        this.opcodes[0xF2] = new SBC(cpu,0xF2, 5, 2, AddressingModes.directIndirect);
        this.opcodes[0xF3] = new SBC(cpu,0xF3, 7, 2, AddressingModes.stackY);
        this.opcodes[0xF5] = new SBC(cpu,0xF5, 4, 2, AddressingModes.directX);
        this.opcodes[0xF7] = new SBC(cpu,0xF7, 6, 2, AddressingModes.directIndirectIndexedLong);
        this.opcodes[0xF9] = new SBC(cpu,0xF9, 4, 3, AddressingModes.absoluteY);
        this.opcodes[0xFD] = new SBC(cpu,0xFD, 4, 3, AddressingModes.absoluteX);
        this.opcodes[0xFF] = new SBC(cpu,0xFF, 5, 4, AddressingModes.longX);

        this.opcodes[0x06] = new ASL(cpu,0x06, 5, 2, AddressingModes.direct);
        this.opcodes[0x0A] = new ASL(cpu,0x0A, 2, 1, AddressingModes.accumulator);
        this.opcodes[0x0E] = new ASL(cpu,0x0E, 6, 3, AddressingModes.absolute);
        this.opcodes[0x16] = new ASL(cpu,0x16, 6, 2, AddressingModes.directX);
        this.opcodes[0x1E] = new ASL(cpu,0x1E, 7, 3, AddressingModes.absoluteX);

        this.opcodes[0x90] = new BCC(cpu,0x90, 2, 2, AddressingModes.relative8);
        this.opcodes[0xB0] = new BCS(cpu,0xB0, 2, 2, AddressingModes.relative8);
        this.opcodes[0xF0] = new BEQ(cpu,0xF0, 2, 2, AddressingModes.relative8);

        this.opcodes[0x24] = new BIT(cpu,0x24, 3, 2, AddressingModes.direct);
        this.opcodes[0x2C] = new BIT(cpu,0x2C, 4, 3, AddressingModes.absolute);
        this.opcodes[0x34] = new BIT(cpu,0x34, 4, 2, AddressingModes.directX);
        this.opcodes[0x3C] = new BIT(cpu,0x3C, 4, 3, AddressingModes.absoluteX);
        this.opcodes[0x89] = new BIT(cpu,0x89, 2, 3, AddressingModes.immediateM);

        this.opcodes[0x30] = new BMI(cpu,0x30, 2, 2, AddressingModes.relative8);
        this.opcodes[0xD0] = new BNE(cpu,0xD0, 2, 2, AddressingModes.relative8);
        this.opcodes[0x10] = new BPL(cpu,0x10, 2, 2, AddressingModes.relative8);
        this.opcodes[0x80] = new BRA(cpu,0x80, 3, 2, AddressingModes.relative8);
        this.opcodes[0x50] = new BVC(cpu,0x50, 2, 2, AddressingModes.relative8);
        this.opcodes[0x70] = new BVS(cpu,0x70, 2, 2, AddressingModes.relative8);

        this.opcodes[0x82] = new BRL(cpu,0x82, 4, 3, AddressingModes.relative16);

        this.opcodes[0x18] = new CLC(cpu,0x18, 2, 1, AddressingModes.implied);
        this.opcodes[0xD8] = new CLD(cpu,0xD8, 2, 1, AddressingModes.implied);
        this.opcodes[0x58] = new CLI(cpu,0x58, 2, 1, AddressingModes.implied);
        this.opcodes[0xB8] = new CLV(cpu,0xB8, 2, 1, AddressingModes.implied);
        this.opcodes[0x38] = new SEC(cpu,0x38, 2, 1, AddressingModes.implied);
        this.opcodes[0xF8] = new SED(cpu,0xF8, 2, 1, AddressingModes.implied);
        this.opcodes[0x78] = new SEI(cpu,0x78, 2, 1, AddressingModes.implied);

        this.opcodes[0xC1] = new CMP(cpu,0xC1, 6, 2, AddressingModes.directIndirectIndexed);
        this.opcodes[0xC3] = new CMP(cpu,0xC3, 4, 2, AddressingModes.stack);
        this.opcodes[0xC5] = new CMP(cpu,0xC5, 3, 2, AddressingModes.direct);
        this.opcodes[0xC7] = new CMP(cpu,0xC7, 6, 2, AddressingModes.directIndexedIndirect);
        this.opcodes[0xC9] = new CMP(cpu,0xC9, 2, 3, AddressingModes.immediateM);
        this.opcodes[0xCD] = new CMP(cpu,0xCD, 4, 3, AddressingModes.absolute);
        this.opcodes[0xCF] = new CMP(cpu,0xCF, 5, 4, AddressingModes.long);
        this.opcodes[0xD1] = new CMP(cpu,0xD1, 5, 2, AddressingModes.directIndirectLong);
        this.opcodes[0xD2] = new CMP(cpu,0xD2, 5, 2, AddressingModes.directIndirect);
        this.opcodes[0xD3] = new CMP(cpu,0xD3, 7, 2, AddressingModes.stackY);
        this.opcodes[0xD5] = new CMP(cpu,0xD5, 4, 2, AddressingModes.directX);
        this.opcodes[0xD7] = new CMP(cpu,0xD7, 6, 2, AddressingModes.directIndirectIndexedLong);
        this.opcodes[0xD9] = new CMP(cpu,0xD9, 4, 3, AddressingModes.absoluteY);
        this.opcodes[0xDD] = new CMP(cpu,0xDD, 4, 3, AddressingModes.absoluteX);
        this.opcodes[0xDF] = new CMP(cpu,0xDF, 5, 4, AddressingModes.longX);

        this.opcodes[0xE0] = new CPX(cpu,0xE0, 2, 3, AddressingModes.immediateX);
        this.opcodes[0xE4] = new CPX(cpu,0xE4, 3, 2, AddressingModes.direct);
        this.opcodes[0xEC] = new CPX(cpu,0xEC, 4, 3, AddressingModes.absolute);

        this.opcodes[0xC0] = new CPY(cpu,0xC0, 2, 3, AddressingModes.immediateX);
        this.opcodes[0xC4] = new CPY(cpu,0xC4, 5, 2, AddressingModes.direct);
        this.opcodes[0xCC] = new CPY(cpu,0xCC, 6, 3, AddressingModes.absolute);

        this.opcodes[0x00] = new BRK(cpu,0x00, 7, 1, AddressingModes.implied);
        this.opcodes[0x02] = new COP(cpu,0x02, 7, 2, AddressingModes.immediate8);

        this.opcodes[0x3A] = new DEC(cpu,0x3A, 2, 1, AddressingModes.accumulator);
        this.opcodes[0xC6] = new DEC(cpu,0xC6, 5, 2, AddressingModes.direct);
        this.opcodes[0xCE] = new DEC(cpu,0xCE, 6, 3, AddressingModes.absolute);
        this.opcodes[0xD6] = new DEC(cpu,0xD6, 6, 2, AddressingModes.directX);
        this.opcodes[0xDE] = new DEC(cpu,0xDE, 7, 3, AddressingModes.absoluteX);
        this.opcodes[0xCA] = new DEX(cpu,0xCA, 2, 1, AddressingModes.implied);
        this.opcodes[0x88] = new DEY(cpu,0x88, 2, 1, AddressingModes.implied);

        this.opcodes[0x1A] = new INC(cpu,0x1A, 2, 1, AddressingModes.accumulator);
        this.opcodes[0xE6] = new INC(cpu,0xE6, 5, 2, AddressingModes.direct);
        this.opcodes[0xEE] = new INC(cpu,0xEE, 6, 3, AddressingModes.absolute);
        this.opcodes[0xF6] = new INC(cpu,0xF6, 6, 2, AddressingModes.directX);
        this.opcodes[0xFE] = new INC(cpu,0xFE, 7, 3, AddressingModes.absoluteX);
        this.opcodes[0xE8] = new INX(cpu,0xE8, 2, 1, AddressingModes.implied);
        this.opcodes[0xC8] = new INY(cpu,0xC8, 2, 1, AddressingModes.implied);

        this.opcodes[0x21] = new AND(cpu,0x21, 6, 2, AddressingModes.directIndirectIndexed);
        this.opcodes[0x23] = new AND(cpu,0x23, 4, 2, AddressingModes.stack);
        this.opcodes[0x25] = new AND(cpu,0x25, 3, 2, AddressingModes.direct);
        this.opcodes[0x27] = new AND(cpu,0x27, 6, 2, AddressingModes.directIndexedIndirect);
        this.opcodes[0x29] = new AND(cpu,0x29, 2, 3, AddressingModes.immediateM);
        this.opcodes[0x2D] = new AND(cpu,0x2D, 4, 3, AddressingModes.absolute);
        this.opcodes[0x2F] = new AND(cpu,0x2F, 5, 4, AddressingModes.long);
        this.opcodes[0x31] = new AND(cpu,0x31, 5, 2, AddressingModes.directIndirectLong);
        this.opcodes[0x32] = new AND(cpu,0x32, 5, 2, AddressingModes.directIndirect);
        this.opcodes[0x33] = new AND(cpu,0x33, 7, 2, AddressingModes.stackY);
        this.opcodes[0x35] = new AND(cpu,0x35, 4, 2, AddressingModes.directX);
        this.opcodes[0x37] = new AND(cpu,0x37, 6, 2, AddressingModes.directIndirectIndexedLong);
        this.opcodes[0x39] = new AND(cpu,0x39, 4, 3, AddressingModes.absoluteY);
        this.opcodes[0x3D] = new AND(cpu,0x3D, 4, 3, AddressingModes.absoluteX);
        this.opcodes[0x3F] = new AND(cpu,0x3F, 5, 4, AddressingModes.longX);

        this.opcodes[0x41] = new EOR(cpu,0x41, 6, 2, AddressingModes.directIndirectIndexed);
        this.opcodes[0x43] = new EOR(cpu,0x43, 4, 2, AddressingModes.stack);
        this.opcodes[0x45] = new EOR(cpu,0x45, 3, 2, AddressingModes.direct);
        this.opcodes[0x47] = new EOR(cpu,0x47, 6, 2, AddressingModes.directIndexedIndirect);
        this.opcodes[0x49] = new EOR(cpu,0x49, 2, 3, AddressingModes.immediateM);
        this.opcodes[0x4D] = new EOR(cpu,0x4D, 4, 3, AddressingModes.absolute);
        this.opcodes[0x4F] = new EOR(cpu,0x4F, 5, 4, AddressingModes.long);
        this.opcodes[0x51] = new EOR(cpu,0x51, 5, 2, AddressingModes.directIndirectLong);
        this.opcodes[0x52] = new EOR(cpu,0x52, 5, 2, AddressingModes.directIndirect);
        this.opcodes[0x53] = new EOR(cpu,0x53, 7, 2, AddressingModes.stackY);
        this.opcodes[0x55] = new EOR(cpu,0x55, 4, 2, AddressingModes.directX);
        this.opcodes[0x57] = new EOR(cpu,0x57, 6, 2, AddressingModes.directIndirectIndexedLong);
        this.opcodes[0x59] = new EOR(cpu,0x59, 4, 3, AddressingModes.absoluteY);
        this.opcodes[0x5D] = new EOR(cpu,0x5D, 4, 3, AddressingModes.absoluteX);
        this.opcodes[0x5F] = new EOR(cpu,0x5F, 5, 4, AddressingModes.longX);

        this.opcodes[0x4C] = new JMP(cpu,0x4C, 3, 3, AddressingModes.absoluteJump);
        this.opcodes[0x5C] = new JMP(cpu,0x5C, 4, 4, AddressingModes.long);
        this.opcodes[0x6C] = new JMP(cpu,0x6C, 5, 3, AddressingModes.absoluteLong);
        this.opcodes[0x7C] = new JMP(cpu,0x7C, 6, 3, AddressingModes.absoluteIndirect);
        this.opcodes[0xDC] = new JMP(cpu,0xDC, 6, 3, AddressingModes.absoluteLongIndexed);

        this.opcodes[0x22] = new JSL(cpu,0x22, 8, 4, AddressingModes.long);
        this.opcodes[0x20] = new JSR(cpu,0x20, 6, 3, AddressingModes.absolute);
        this.opcodes[0xFC] = new JSR(cpu,0xFC, 8, 3, AddressingModes.absoluteIndirect);

        this.opcodes[0xA1] = new LDA(cpu,0xA1, 6, 2, AddressingModes.directIndirectIndexed);
        this.opcodes[0xA3] = new LDA(cpu,0xA3, 4, 2, AddressingModes.stack);
        this.opcodes[0xA5] = new LDA(cpu,0xA5, 3, 2, AddressingModes.direct);
        this.opcodes[0xA7] = new LDA(cpu,0xA7, 6, 2, AddressingModes.directIndexedIndirect);
        this.opcodes[0xA9] = new LDA(cpu,0xA9, 2, 3, AddressingModes.immediateM);
        this.opcodes[0xAD] = new LDA(cpu,0xAD, 4, 3, AddressingModes.absolute);
        this.opcodes[0xAF] = new LDA(cpu,0xAF, 5, 4, AddressingModes.long);
        this.opcodes[0xB1] = new LDA(cpu,0xB1, 5, 2, AddressingModes.directIndirectLong);
        this.opcodes[0xB2] = new LDA(cpu,0xB2, 5, 2, AddressingModes.directIndirect);
        this.opcodes[0xB3] = new LDA(cpu,0xB3, 7, 2, AddressingModes.stackY);
        this.opcodes[0xB5] = new LDA(cpu,0xB5, 4, 2, AddressingModes.directX);
        this.opcodes[0xB7] = new LDA(cpu,0xB7, 6, 2, AddressingModes.directIndirectIndexedLong);
        this.opcodes[0xB9] = new LDA(cpu,0xB9, 4, 3, AddressingModes.absoluteY);
        this.opcodes[0xBD] = new LDA(cpu,0xBD, 4, 3, AddressingModes.absoluteX);
        this.opcodes[0xBF] = new LDA(cpu,0xBF, 5, 4, AddressingModes.longX);

        this.opcodes[0xA2] = new LDX(cpu,0xA2, 3, 3, AddressingModes.immediateX);
        this.opcodes[0xA6] = new LDX(cpu,0xA6, 3, 2, AddressingModes.direct);
        this.opcodes[0xAE] = new LDX(cpu,0xAE, 4, 3, AddressingModes.absolute);
        this.opcodes[0xB6] = new LDX(cpu,0xB6, 4, 2, AddressingModes.directY);
        this.opcodes[0xBE] = new LDX(cpu,0xBE, 4, 3, AddressingModes.absoluteY);

        this.opcodes[0xA0] = new LDY(cpu,0xA0, 2, 3, AddressingModes.immediateX);
        this.opcodes[0xA4] = new LDY(cpu,0xA4, 3, 2, AddressingModes.direct);
        this.opcodes[0xAC] = new LDY(cpu,0xAC, 4, 3, AddressingModes.absolute);
        this.opcodes[0xB4] = new LDY(cpu,0xB4, 4, 2, AddressingModes.directX);
        this.opcodes[0xBC] = new LDY(cpu,0xBC, 4, 3, AddressingModes.absoluteX);

        this.opcodes[0x81] = new STA(cpu,0x81, 6, 2, AddressingModes.directIndirectIndexed);
        this.opcodes[0x83] = new STA(cpu,0x83, 4, 2, AddressingModes.stack);
        this.opcodes[0x85] = new STA(cpu,0x85, 3, 2, AddressingModes.direct);
        this.opcodes[0x87] = new STA(cpu,0x87, 6, 2, AddressingModes.directIndexedIndirect);
        this.opcodes[0x8D] = new STA(cpu,0x8D, 4, 3, AddressingModes.absolute);
        this.opcodes[0x8F] = new STA(cpu,0x8F, 5, 4, AddressingModes.long);
        this.opcodes[0x91] = new STA(cpu,0x91, 6, 2, AddressingModes.directIndirectLong);
        this.opcodes[0x92] = new STA(cpu,0x92, 5, 2, AddressingModes.directIndirect);
        this.opcodes[0x93] = new STA(cpu,0x93, 7, 2, AddressingModes.stackY);
        this.opcodes[0x95] = new STA(cpu,0x95, 4, 2, AddressingModes.directX);
        this.opcodes[0x97] = new STA(cpu,0x97, 6, 2, AddressingModes.directIndirectIndexedLong);
        this.opcodes[0x99] = new STA(cpu,0x99, 5, 3, AddressingModes.absoluteY);
        this.opcodes[0x9D] = new STA(cpu,0x9D, 5, 3, AddressingModes.absoluteX);
        this.opcodes[0x9F] = new STA(cpu,0x9F, 5, 4, AddressingModes.longX);

        this.opcodes[0x86] = new STX(cpu,0x86, 3, 2, AddressingModes.direct);
        this.opcodes[0x8E] = new STX(cpu,0x8E, 4, 3, AddressingModes.absolute);
        this.opcodes[0x96] = new STX(cpu,0x96, 4, 2, AddressingModes.directY);

        this.opcodes[0x84] = new STY(cpu,0x84, 3, 2, AddressingModes.direct);
        this.opcodes[0x8C] = new STY(cpu,0x8C, 4, 3, AddressingModes.absolute);
        this.opcodes[0x94] = new STY(cpu,0x94, 4, 2, AddressingModes.directX);

        this.opcodes[0x64] = new STZ(cpu,0x64, 3, 2, AddressingModes.direct);
        this.opcodes[0x74] = new STZ(cpu,0x74, 4, 2, AddressingModes.directX);
        this.opcodes[0x9C] = new STZ(cpu,0x9C, 4, 3, AddressingModes.absolute);
        this.opcodes[0x9E] = new STZ(cpu,0x9E, 5, 3, AddressingModes.absoluteX);

        this.opcodes[0xDB] = new STP(cpu,0xDB, 3, 0, AddressingModes.implied);
        this.opcodes[0xCB] = new WAI(cpu,0xCB, 3, 1, AddressingModes.implied);

        this.opcodes[0x46] = new LSR(cpu,0x46, 5, 2, AddressingModes.direct);
        this.opcodes[0x4A] = new LSR(cpu,0x4A, 2, 1, AddressingModes.accumulator);
        this.opcodes[0x4E] = new LSR(cpu,0x4E, 6, 3, AddressingModes.absolute);
        this.opcodes[0x56] = new LSR(cpu,0x56, 6, 2, AddressingModes.directX);
        this.opcodes[0x5E] = new LSR(cpu,0x5E, 7, 3, AddressingModes.absoluteX);

        this.opcodes[0x26] = new ROL(cpu,0x26, 2, 2, AddressingModes.direct);
        this.opcodes[0x2A] = new ROL(cpu,0x2A, 2, 1, AddressingModes.accumulator);
        this.opcodes[0x2E] = new ROL(cpu,0x2E, 6, 3, AddressingModes.absolute);
        this.opcodes[0x36] = new ROL(cpu,0x36, 6, 2, AddressingModes.directX);
        this.opcodes[0x3E] = new ROL(cpu,0x3E, 7, 3, AddressingModes.absoluteX);

        this.opcodes[0x66] = new ROR(cpu,0x66, 5, 2, AddressingModes.direct);
        this.opcodes[0x6A] = new ROR(cpu,0x6A, 2, 1, AddressingModes.accumulator);
        this.opcodes[0x6E] = new ROR(cpu,0x6E, 6, 3, AddressingModes.absolute);
        this.opcodes[0x76] = new ROR(cpu,0x76, 6, 2, AddressingModes.directX);
        this.opcodes[0x7E] = new ROR(cpu,0x7E, 7, 3, AddressingModes.absoluteX);

        this.opcodes[0x54] = new MVN(cpu,0x54, 1, 3, AddressingModes.sourceDestination);
        this.opcodes[0x44] = new MVP(cpu,0x44, 1, 3, AddressingModes.sourceDestination);

        this.opcodes[0xEA] = new NOP(cpu,0xEA, 2, 1, AddressingModes.implied);
        this.opcodes[0x42] = new WDM(cpu,0x42, 2, 2, AddressingModes.immediateM);

        this.opcodes[0x01] = new ORA(cpu,0x01, 6, 2, AddressingModes.directIndirectIndexed);
        this.opcodes[0x03] = new ORA(cpu,0x03, 4, 2, AddressingModes.stack);
        this.opcodes[0x05] = new ORA(cpu,0x05, 3, 2, AddressingModes.direct);
        this.opcodes[0x07] = new ORA(cpu,0x07, 6, 2, AddressingModes.directIndexedIndirect);
        this.opcodes[0x09] = new ORA(cpu,0x09, 2, 3, AddressingModes.immediateM);
        this.opcodes[0x0D] = new ORA(cpu,0x0D, 4, 3, AddressingModes.absolute);
        this.opcodes[0x0F] = new ORA(cpu,0x0F, 5, 4, AddressingModes.long);
        this.opcodes[0x11] = new ORA(cpu,0x11, 5, 2, AddressingModes.directIndirectLong);
        this.opcodes[0x12] = new ORA(cpu,0x12, 5, 2, AddressingModes.directIndirect);
        this.opcodes[0x13] = new ORA(cpu,0x13, 7, 2, AddressingModes.stackY);
        this.opcodes[0x15] = new ORA(cpu,0x15, 4, 2, AddressingModes.directX);
        this.opcodes[0x17] = new ORA(cpu,0x17, 6, 2, AddressingModes.directIndirectIndexedLong);
        this.opcodes[0x19] = new ORA(cpu,0x19, 4, 3, AddressingModes.absoluteY);
        this.opcodes[0x1D] = new ORA(cpu,0x1D, 4, 3, AddressingModes.absoluteX);
        this.opcodes[0x1F] = new ORA(cpu,0x1F, 5, 4, AddressingModes.longX);

        this.opcodes[0xF4] = new PEA(cpu,0xF4, 5, 3, AddressingModes.immediate16);
        this.opcodes[0xD4] = new PEI(cpu,0xD4, 6, 2, AddressingModes.direct);
        this.opcodes[0x62] = new PER(cpu,0x62, 6, 3, AddressingModes.immediate16);

        this.opcodes[0x48] = new PHA(cpu,0x48, 3, 1, AddressingModes.implied);
        this.opcodes[0xDA] = new PHX(cpu,0xDA, 3, 1, AddressingModes.implied);
        this.opcodes[0x5A] = new PHY(cpu,0x5A, 3, 1, AddressingModes.implied);
        this.opcodes[0x68] = new PLA(cpu,0x68, 4, 1, AddressingModes.implied);
        this.opcodes[0xFA] = new PLX(cpu,0xFA, 4, 1, AddressingModes.implied);
        this.opcodes[0x7A] = new PLY(cpu,0x7A, 4, 1, AddressingModes.implied);

        this.opcodes[0x8B] = new PHB(cpu,0x8B, 3, 1, AddressingModes.implied);
        this.opcodes[0x0B] = new PHD(cpu,0x0B, 4, 1, AddressingModes.implied);
        this.opcodes[0x4B] = new PHK(cpu,0x4B, 3, 1, AddressingModes.implied);
        this.opcodes[0x08] = new PHP(cpu,0x08, 3, 1, AddressingModes.implied);
        this.opcodes[0xAB] = new PLB(cpu,0xAB, 4, 1, AddressingModes.implied);
        this.opcodes[0x2B] = new PLD(cpu,0x2B, 5, 1, AddressingModes.implied);
        this.opcodes[0x28] = new PLP(cpu,0x28, 4, 1, AddressingModes.implied);

        this.opcodes[0xC2] = new REP(cpu,0xC2, 3, 2, AddressingModes.immediate8);
        this.opcodes[0xE2] = new SEP(cpu,0xE2, 3, 2, AddressingModes.immediate8);

        this.opcodes[0x40] = new RTI(cpu,0x40, 6, 1, AddressingModes.implied);

        this.opcodes[0x6B] = new RTL(cpu,0x6B, 6, 1, AddressingModes.implied);
        this.opcodes[0x60] = new RTS(cpu,0x60, 6, 1, AddressingModes.implied);

        this.opcodes[0xAA] = new TAX(cpu,0xAA, 2, 1, AddressingModes.implied);
        this.opcodes[0xA8] = new TAY(cpu,0xA8, 2, 1, AddressingModes.implied);
        this.opcodes[0xBA] = new TSX(cpu,0xBA, 2, 1, AddressingModes.implied);
        this.opcodes[0x8A] = new TXA(cpu,0x8A, 2, 1, AddressingModes.implied);
        this.opcodes[0x9A] = new TXS(cpu,0x9A, 2, 1, AddressingModes.implied);
        this.opcodes[0x9B] = new TXY(cpu,0x9B, 2, 1, AddressingModes.implied);
        this.opcodes[0x98] = new TYA(cpu,0x98, 2, 1, AddressingModes.implied);
        this.opcodes[0xBB] = new TYX(cpu,0xBB, 2, 1, AddressingModes.implied);

        this.opcodes[0x5B] = new TCD(cpu,0x5B, 2, 1, AddressingModes.implied);
        this.opcodes[0x1B] = new TCS(cpu,0x1B, 2, 1, AddressingModes.implied);
        this.opcodes[0x7B] = new TDC(cpu,0x7B, 2, 1, AddressingModes.implied);
        this.opcodes[0x3B] = new TSC(cpu,0x3B, 2, 1, AddressingModes.implied);

        this.opcodes[0x14] = new TRB(cpu,0x14, 5, 2, AddressingModes.direct);
        this.opcodes[0x1C] = new TRB(cpu,0x1C, 6, 3, AddressingModes.absolute);
        this.opcodes[0x04] = new TSB(cpu,0x04, 5, 2, AddressingModes.direct);
        this.opcodes[0x0C] = new TSB(cpu,0x0C, 6, 3, AddressingModes.absolute);

        this.opcodes[0xEB] = new XBA(cpu,0xEB, 1, 1, AddressingModes.implied);

        this.opcodes[0xFB] = new XCE(cpu,0xFB, 1, 1, AddressingModes.implied);

    }

    public get(code: number): Operation {
        if (code == null || code < 0 || code > this.opcodes.length) {
            throw new Error("got invalid opcode: " + code);
        }
        let opcode: Operation = this.opcodes[code];
        Objects.requireNonNull(opcode, "got null opcode: " + code);

        return opcode;
    }
}
