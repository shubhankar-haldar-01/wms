import React, { createContext, useContext, useState, useEffect } from "react";
import { createTheme, ThemeProvider } from "@mui/material/styles";

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

export const CustomThemeProvider = ({ children }) => {
  const [themeMode, setThemeMode] = useState("light");
  const [fontSize, setFontSize] = useState("medium");

  // Load theme settings from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem("wms-theme-mode");
    const savedFontSize = localStorage.getItem("wms-font-size");

    if (savedTheme) {
      setThemeMode(savedTheme);
    }
    if (savedFontSize) {
      setFontSize(savedFontSize);
    }
  }, []);

  // Save theme settings to localStorage
  useEffect(() => {
    localStorage.setItem("wms-theme-mode", themeMode);
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem("wms-font-size", fontSize);
  }, [fontSize]);

  const toggleTheme = () => {
    setThemeMode((prev) => (prev === "light" ? "dark" : "light"));
  };

  const changeFontSize = (size) => {
    setFontSize(size);
  };

  // Create theme based on mode and font size
  const theme = createTheme({
    palette: {
      mode: themeMode,
      primary: {
        main: "#1976d2",
      },
      secondary: {
        main: "#dc004e",
      },
    },
    typography: {
      fontSize: fontSize === "small" ? 12 : fontSize === "medium" ? 14 : 16,
      h1: {
        fontSize:
          fontSize === "small"
            ? "1.5rem"
            : fontSize === "medium"
            ? "2rem"
            : "2.5rem",
      },
      h2: {
        fontSize:
          fontSize === "small"
            ? "1.25rem"
            : fontSize === "medium"
            ? "1.5rem"
            : "2rem",
      },
      h3: {
        fontSize:
          fontSize === "small"
            ? "1.125rem"
            : fontSize === "medium"
            ? "1.25rem"
            : "1.5rem",
      },
      h4: {
        fontSize:
          fontSize === "small"
            ? "1rem"
            : fontSize === "medium"
            ? "1.125rem"
            : "1.25rem",
      },
      h5: {
        fontSize:
          fontSize === "small"
            ? "0.875rem"
            : fontSize === "medium"
            ? "1rem"
            : "1.125rem",
      },
      h6: {
        fontSize:
          fontSize === "small"
            ? "0.75rem"
            : fontSize === "medium"
            ? "0.875rem"
            : "1rem",
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            fontSize:
              fontSize === "small"
                ? "0.75rem"
                : fontSize === "medium"
                ? "0.875rem"
                : "1rem",
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            "& .MuiInputBase-input": {
              fontSize:
                fontSize === "small"
                  ? "0.75rem"
                  : fontSize === "medium"
                  ? "0.875rem"
                  : "1rem",
            },
          },
        },
      },
    },
  });

  const value = {
    themeMode,
    fontSize,
    toggleTheme,
    changeFontSize,
  };

  return (
    <ThemeContext.Provider value={value}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </ThemeContext.Provider>
  );
};
