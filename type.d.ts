declare global {
    interface fridgeItemsType {
        name: string;
        quantity: number;
        unit: string;
        expires_at: Date;
    }
}

export {};