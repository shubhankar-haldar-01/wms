import { useQuery, useQueryClient } from "react-query";
import axios from "axios";

// Custom hook for consistent product queries across the app
export const useProducts = (options = {}) => {
  const queryClient = useQueryClient();

  const defaultOptions = {
    queryKey: "products",
    queryFn: () =>
      axios.get("/api/products?limit=1000").then((res) => res.data),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    ...options,
  };

  return useQuery(defaultOptions);
};

// Utility function to invalidate all product-related queries
export const useInvalidateProducts = () => {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries("products");
    queryClient.invalidateQueries("products-filter");
    queryClient.invalidateQueries("barcodes");
  };
};
