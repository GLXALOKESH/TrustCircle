import toast from "react-hot-toast";

export function useTxToast() {
  async function withToast(txPromise) {
    const toastId = toast.loading("Submitting...");
    try {
      const tx = await txPromise;
      toast.loading("Confirming...", { id: toastId });
      const rec = await tx.wait();
      toast.success("Confirmed!", { id: toastId });
      return rec;
    } catch (err) {
      toast.error(err.reason || "Transaction failed", { id: toastId });
      throw err;
    }
  }

  return { withToast };
}
