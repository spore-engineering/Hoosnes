import {Ppu} from "./Ppu";
import {Objects} from "../util/Objects";
import {BppType} from "./Palette";
import {Vram} from "../memory/Vram";
import {Address} from "../bus/Address";

export class Dimension {

    public height: number = 8;
    public width: number = 8;

    private static readonly dimension8by8: Dimension = Dimension.create(8,8);
    private static readonly dimension16by16: Dimension = Dimension.create(16,16);
    private static readonly dimension32by32: Dimension = Dimension.create(32,32);
    private static readonly dimension64by64: Dimension = Dimension.create(64,64);

    constructor(width: number, height: number) {
        Objects.requireNonNull(width);
        Objects.requireNonNull(height);

        this.width = width;
        this.height = height;
    }

    public static create(height: number, width: number): Dimension {
        let dimension = new Dimension(width, height);
        return dimension;
    }

    public static get8by8(): Dimension {
        return this.dimension8by8;
    }

    public static get16by16(): Dimension {
        return this.dimension16by16;
    }

    public static get32by32(): Dimension {
        return this.dimension32by32;
    }

    public static get64by64(): Dimension {
        return this.dimension64by64;
    }

}

export enum Orientation {
    VERTICAL,
    HORIZONTAL,
    NONE,
}

export class TileAttributes {

    public dimension: Dimension;
    public orientation: Orientation;
    public bpp: BppType = BppType.Two;

    constructor(height: number, width: number, vflip: boolean, hflip: boolean, bpp: BppType) {
        this.dimension = Dimension.create(height, width);
        this.orientation = vflip ? Orientation.VERTICAL :
            ((hflip) ? Orientation.HORIZONTAL : Orientation.NONE);
        this.bpp = bpp;
    }

    public static create(height: number, width: number,  bpp: BppType, vflip?: boolean, hflip?: boolean) {
        return new TileAttributes(height, width, vflip || false, hflip || false, bpp);
    }

    public getTileSize(): number {
        // 2bpp 16
        // 4bpp 32
        // 8bpp 64
        let size: number = 8 * this.bpp.valueOf();
        return size;
    }

    public getHeight(): number {
        return this.dimension.height;
    }

    public getWidth(): number {
        return this.dimension.width;
    }

    public isFlipVertical() {
        return this.orientation == Orientation.VERTICAL;
    }

    public isFlipHorizontal() {
        return this.orientation == Orientation.HORIZONTAL;
    }

}

export class Tiles {

    public ppu: Ppu;
    public vram: Vram;

    constructor(ppu: Ppu) {
        Objects.requireNonNull(ppu);

        this.ppu = ppu;
        this.vram = ppu.vram;
    }

    public getTile(address: Address, attributes: TileAttributes): number[][] {
        Objects.requireNonNull(address);
        Objects.requireNonNull(attributes);

        if (attributes.bpp == BppType.Eight) {
            return this.getTile8Bpp(address, attributes);
        } else {
            return this.getTileNon8Bpp(address, attributes);
        }
    }

    private getTile8Bpp(address: Address, attributes: TileAttributes): number[][] {
        throw new Error("Not implemented!");
    }

    private getTileNon8Bpp(address: Address, attributes: TileAttributes): number[][] {
        let tile = this.create2dMatrix(attributes.getHeight(), attributes.getWidth());
        let bpp: number = attributes.bpp.valueOf();
        let index: number = address.toValue();

        let height: number = 8;
        let width: number = 8;

        let tilesPerRow = 16;

        for (let yBase: number = 0; yBase < attributes.getHeight(); yBase += height) {
            for (let xBase: number = 0; xBase < attributes.getWidth(); xBase += width) {

                let plane: number = 0;
                for (let i = 0; i < bpp / 2; i++) {

                    // Capture 8x8 tile from vram (8 bytes high, 2 bytes long)
                    let rows: number[][] = this.create2dMatrix(8, 2);
                    for (let y = 0; y < rows.length; y++) {
                        for (let x = 0; x < rows[y].length; x++) {
                            rows[y][x] = this.vram.data[index++ % this.vram.data.length];
                        }
                    }

                    // Deconstruct planes into tile matrix
                    let yOffset: number = 0;
                    for (let row of rows) {
                        let shift: number = plane;
                        for (let cell of row) {
                            let bits: number = cell;
                            for (let bitIndex = 0; bitIndex < 8; bitIndex++) {
                                let bit = bits & 1;
                                let xIndex: number = attributes.isFlipHorizontal() ?
                                    (attributes.getWidth() - width - xBase) + bitIndex : xBase + (width - 1 - bitIndex);
                                let yIndex: number = attributes.isFlipVertical() ?
                                    (attributes.getHeight() - height - yBase) + (height - yOffset) : yBase + yOffset;
                                tile[yIndex][xIndex] |= (bit << shift);
                                bits = bits >> 1;
                            }
                            shift++;
                        }
                        yOffset++;
                    }

                    plane += 2;
                }
            }
            index += attributes.getTileSize() * (tilesPerRow - (attributes.getWidth() / 8));
        }


        return tile;
    }

    private create2dMatrix(height: number, width: number) {
        Objects.requireNonNull(height);
        Objects.requireNonNull(width);

        let tile: number[][] = [];
        for (let y = 0; y < height; y++) {
            tile.push([]);
            for (let x = 0; x < width; x++) {
                tile[y].push(0);
            }
        }
        return tile;
    }
}