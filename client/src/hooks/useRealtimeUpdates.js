import { useEffect } from "react";
import { useQueryClient } from "react-query";

export const useRealtimeUpdates = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Handle product updates
    const handleProductCreated = () => {
      queryClient.invalidateQueries("products");
      queryClient.invalidateQueries("products-filter");
      queryClient.invalidateQueries("inventory-overview");
      queryClient.invalidateQueries("dashboard");
    };

    const handleProductUpdated = () => {
      queryClient.invalidateQueries("products");
      queryClient.invalidateQueries("products-filter");
      queryClient.invalidateQueries("inventory-overview");
      queryClient.invalidateQueries("dashboard");
    };

    const handleProductDeleted = () => {
      queryClient.invalidateQueries("products");
      queryClient.invalidateQueries("products-filter");
      queryClient.invalidateQueries("barcodes");
      queryClient.invalidateQueries("inventory-overview");
      queryClient.invalidateQueries("dashboard");
    };

    // Handle barcode updates
    const handleBarcodeCreated = () => {
      queryClient.invalidateQueries("barcodes");
      queryClient.invalidateQueries("inventory-overview");
    };

    const handleBarcodesGenerated = () => {
      queryClient.invalidateQueries("barcodes");
      queryClient.invalidateQueries("products");
      queryClient.invalidateQueries("inventory-overview");
    };

    // Handle transaction updates
    const handleTransactionCreated = () => {
      queryClient.invalidateQueries("scan-history");
      queryClient.invalidateQueries("scan-stats");
      queryClient.invalidateQueries("transactions");
      queryClient.invalidateQueries("inventory-overview");
      queryClient.invalidateQueries("dashboard");
      queryClient.invalidateQueries("stock-levels");

      // Force refetch for immediate updates
      queryClient.refetchQueries("scan-stats");
      queryClient.refetchQueries("scan-history");
    };

    // Handle stock updates
    const handleStockUpdated = () => {
      queryClient.invalidateQueries("inventory-overview");
      queryClient.invalidateQueries("stock-levels");
      queryClient.invalidateQueries("dashboard");
      queryClient.invalidateQueries("scan-stats");

      // Force refetch for immediate updates
      queryClient.refetchQueries("scan-stats");
      queryClient.refetchQueries("dashboard");
    };

    // Add event listeners
    window.addEventListener("productCreated", handleProductCreated);
    window.addEventListener("productUpdated", handleProductUpdated);
    window.addEventListener("productDeleted", handleProductDeleted);
    window.addEventListener("barcodeCreated", handleBarcodeCreated);
    window.addEventListener("barcodesGenerated", handleBarcodesGenerated);
    window.addEventListener("transactionCreated", handleTransactionCreated);
    window.addEventListener("stockUpdated", handleStockUpdated);

    // Cleanup
    return () => {
      window.removeEventListener("productCreated", handleProductCreated);
      window.removeEventListener("productUpdated", handleProductUpdated);
      window.removeEventListener("productDeleted", handleProductDeleted);
      window.removeEventListener("barcodeCreated", handleBarcodeCreated);
      window.removeEventListener("barcodesGenerated", handleBarcodesGenerated);
      window.removeEventListener(
        "transactionCreated",
        handleTransactionCreated
      );
      window.removeEventListener("stockUpdated", handleStockUpdated);
    };
  }, [queryClient]);
};
