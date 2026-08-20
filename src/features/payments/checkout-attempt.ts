export type CreatedCheckoutAttempt = {
  tipId: string;
  orderId: string;
  receiptToken: string;
};

export function createCheckoutAttempt(factory: () => Promise<CreatedCheckoutAttempt>) {
  let current: Promise<CreatedCheckoutAttempt> | null = null;

  return {
    getOrCreate() {
      if (!current) {
        const created = Promise.resolve().then(factory);
        current = created;
        void created.catch(() => {
          if (current === created) current = null;
        });
      }
      return current;
    },
    clear() {
      current = null;
    },
  };
}
