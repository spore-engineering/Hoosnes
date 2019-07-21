export class Address {

}

export class Addressing {
    public static implied : Address = new Address();
    public static immediate : Address = new Address();
    public static relative : Address = new Address();
    public static relativeLong : Address = new Address();
    public static direct : Address = new Address();
    public static directIndexedWithX : Address = new Address();
    public static directIndexedWithY : Address = new Address();
    public static directIndirect : Address = new Address();
    public static directIndexedIndirect : Address = new Address();
    public static directIndirectIndexedLong : Address = new Address();
    public static absolute : Address = new Address();
    public static absoluteIndexedWithX : Address = new Address();
    public static absoluteIndexedWithY : Address = new Address();
    public static absoluteLong : Address = new Address();
    public static absoluteIndexedLong : Address = new Address();
    public static stackRelative : Address = new Address();
    public static stackRelativeIndirectIndexed : Address = new Address();
    public static absoluteIndirect : Address = new Address();
    public static absoluteIndirectLong : Address = new Address();
    public static absoluteIndexedIndirect : Address = new Address();
    public static impliedAccumulator : Address = new Address();
    public static blockMove : Address = new Address();
}
