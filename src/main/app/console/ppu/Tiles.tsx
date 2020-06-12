import {Ppu} from "./Ppu";
import {Objects} from "../../util/Objects";
import {BppType} from "./Palette";
import {Vram} from "../memory/Vram";
import {ArrayUtil} from "../../util/ArrayUtil";
import {AddressUtil} from "../../util/AddressUtil";

export class Dimension {

    public height: number = 8;
    public width: number = 8;

    private static readonly dimension8by8: Dimension = Dimension.create(8,8);
    private static readonly dimension16by16: Dimension = Dimension.create(16,16);
    private static readonly dimension32by32: Dimension = Dimension.create(32,32);
    private static readonly dimension64by64: Dimension = Dimension.create(64,64);
    private static readonly dimension64by32: Dimension = Dimension.create(64,32);
    private static readonly dimension32by64: Dimension = Dimension.create(32,64);

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

    public static get32by64(): Dimension {
        return this.dimension32by64;
    }

    public static get64by32(): Dimension {
        return this.dimension64by32;
    }

    public toString(): string {
        return `${this.height}x${this.width}`;
    }

}

export enum Orientation {
    VERTICAL,
    HORIZONTAL,
    NONE,
}

export interface ITileAttributes {
    height: number;
    width: number;
    yFlipped: boolean;
    xFlipped: boolean;
    bpp: BppType;
}

export function getTileSizeInByte(bpp: BppType): number {
    return 8 * bpp.valueOf();
}

export class Tile {

    public attributes: ITileAttributes;
    public data: number[][];

    constructor(data: number[][], attributes: ITileAttributes) {
        this.data = data;
        this.attributes = attributes;
    }

    public static create(data: number[][], attributes: ITileAttributes) {
        return new Tile(data, attributes);
    }
}

export class Tiles {

    public ppu: Ppu;
    public vram: Vram;

    private tileMatrixFor8By8 = [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
    ];

    constructor(ppu: Ppu) {
        Objects.requireNonNull(ppu);

        this.ppu = ppu;
        this.vram = ppu.vram;
    }


    public getTile(address: number, attributes: ITileAttributes): Tile {
        Objects.requireNonNull(address);
        Objects.requireNonNull(attributes);

        AddressUtil.assertValid(address);

        if (attributes.bpp == BppType.Eight) {
            return this.getTile8Bpp(address, attributes);
        } else {
            return this.getTileNon8Bpp(address, attributes);
        }
    }

    private getTile8Bpp(address: number, attributes: ITileAttributes): Tile {
        throw new Error("Not implemented!");
    }

    private getTileNon8Bpp(address: number, attributes: ITileAttributes): Tile {
        let image: number[][] = ArrayUtil.create2dMatrix(attributes.height, attributes.width);
        const bpp: number = attributes.bpp.valueOf();
        const bytesPerRow = getTileSizeInByte(bpp);

        let index: number = address;

        let height: number = 8;
        let width: number = 8;

        let tilesPerRow = 16;

        for (let yBase: number = 0; yBase < attributes.height; yBase += height) {
            for (let xBase: number = 0; xBase < attributes.width; xBase += width) {

                let plane: number = 0;
                for (let i = 0; i < bpp / 2; i++) {

                    // Capture 8x8 tile from vram (8 bytes high, 2 bytes long)
                    let rows: number[][] = this.tileMatrixFor8By8;
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
                                let xIndex: number = attributes.xFlipped ?
                                    (attributes.width - width - xBase) + bitIndex : xBase + (width - 1 - bitIndex);
                                let yIndex: number = attributes.yFlipped ?
                                    (attributes.height - height - yBase) + (height - 1 - yOffset) : yBase + yOffset;
                                image[yIndex][xIndex] |= (bit << shift);
                                bits = bits >> 1;
                            }
                            shift++;
                        }
                        yOffset++;
                    }

                    plane += 2;
                }
            }
            index += bytesPerRow * (tilesPerRow - (attributes.width / 8));
        }


        return Tile.create(image, attributes);
    }


}