import {Cartridge, ICartridgeMapping} from "./Cartridge";
import {Sram} from "../memory/Sram";

export class CartridgeMapping2 implements ICartridgeMapping {

    public ids: number[] = [0x22, 0x2A];
    public label: string = "SUPER MMC";

    private cartridge: Cartridge;
    private sram: Sram;

    constructor(cartridge: Cartridge) {
        this.cartridge = cartridge;
    }

    public read(address: number): number {
        return null;
    }

    public write(address: number, value: number): void {
    }

}
