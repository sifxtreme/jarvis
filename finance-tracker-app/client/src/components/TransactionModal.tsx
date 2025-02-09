import * as Dialog from '@radix-ui/react-dialog';
import { Transaction } from "../lib/api";
import { Cross2Icon } from '@radix-ui/react-icons';

interface TransactionModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => Promise<void>;
  transaction?: Transaction;
  title: string;
}

export function TransactionModal({
  open,
  onClose,
  onSubmit,
  transaction,
  title
}: TransactionModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] max-h-[85vh] w-[90vw] max-w-[600px] translate-x-[-50%] translate-y-[-50%] rounded-[6px] bg-white p-[25px] shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          <Dialog.Title className="m-0 text-[17px] font-medium mb-4">
            {title}
          </Dialog.Title>

          <form onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            await onSubmit(formData);
          }}>
            <div className="grid gap-4">
              {/* First row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label htmlFor="transacted_at" className="text-[15px]">Date</label>
                  <input
                    id="transacted_at"
                    type="date"
                    name="transacted_at"
                    defaultValue={transaction?.transacted_at.split('T')[0] || new Date().toISOString().split('T')[0]}
                    className="w-full p-2 border rounded"
                  />
                </div>

                <div className="grid gap-2">
                  <label htmlFor="amount" className="text-[15px]">Amount</label>
                  <input
                    id="amount"
                    type="number"
                    name="amount"
                    defaultValue={transaction?.amount}
                    step="0.01"
                    className="w-full p-2 border rounded text-right font-mono"
                  />
                </div>
              </div>

              {/* Second row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label htmlFor="plaid_name" className="text-[15px]">Vendor</label>
                  <input
                    id="plaid_name"
                    type="text"
                    name="plaid_name"
                    defaultValue={transaction?.plaid_name}
                    className="w-full p-2 border rounded"
                  />
                </div>

                <div className="grid gap-2">
                  <label htmlFor="merchant_name" className="text-[15px]">Merchant</label>
                  <input
                    id="merchant_name"
                    type="text"
                    name="merchant_name"
                    defaultValue={transaction?.merchant_name}
                    className="w-full p-2 border rounded"
                  />
                </div>
              </div>

              {/* Third row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label htmlFor="category" className="text-[15px]">Category</label>
                  <input
                    id="category"
                    type="text"
                    name="category"
                    defaultValue={transaction?.category}
                    className="w-full p-2 border rounded"
                  />
                </div>

                <div className="grid gap-2">
                  <label htmlFor="source" className="text-[15px]">Source</label>
                  <input
                    id="source"
                    type="text"
                    name="source"
                    defaultValue={transaction?.source}
                    className="w-full p-2 border rounded"
                  />
                </div>
              </div>

              {/* Status checkboxes */}
              {transaction && (
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="hidden"
                      name="hidden"
                      defaultChecked={transaction.hidden}
                      className="w-4 h-4"
                    />
                    <label htmlFor="hidden" className="text-[15px]">Hidden</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="reviewed"
                      name="reviewed"
                      defaultChecked={transaction.reviewed}
                      className="w-4 h-4"
                    />
                    <label htmlFor="reviewed" className="text-[15px]">Reviewed</label>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded px-4 py-2 text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                Save
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded px-4 py-2 text-sm font-medium border border-gray-200 bg-white text-gray-900 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
              >
                Cancel
              </button>
            </div>
          </form>

          <Dialog.Close asChild>
            <button
              className="absolute right-[10px] top-[10px] inline-flex h-[25px] w-[25px] appearance-none items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 focus:outline-none"
              aria-label="Close"
            >
              <Cross2Icon />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}