import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      // Initialize socket connection - dynamically detect server URL
      const serverUrl =
        process.env.REACT_APP_SERVER_URL ||
        window.location.protocol +
          '//' +
          window.location.hostname +
          ':' +
          (window.location.port || '5001');

      const newSocket = io(serverUrl, {
        auth: {
          userId: user.id,
          username: user.username,
        },
        // Add connection options for better stability
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: true,
        timeout: 20000,
        forceNew: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        maxReconnectionAttempts: 5,
      });

      newSocket.on('connect', () => {
        console.log('Connected to server');
        setConnected(true);

        // Join user-specific room
        newSocket.emit('join_room', `user_${user.id}`);

        // Join general notifications room
        newSocket.emit('join_room', 'general');
      });

      newSocket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
        setConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setConnected(false);
      });

      newSocket.on('reconnect', (attemptNumber) => {
        console.log('Reconnected to server after', attemptNumber, 'attempts');
        setConnected(true);
      });

      newSocket.on('reconnect_attempt', (attemptNumber) => {
        console.log('Reconnection attempt:', attemptNumber);
      });

      newSocket.on('reconnect_error', (error) => {
        console.error('Reconnection error:', error);
      });

      newSocket.on('reconnect_failed', () => {
        console.error('Failed to reconnect to server');
        setConnected(false);
      });

      // Real-time event handlers
      newSocket.on('product_created', (product) => {
        toast.success(`New product created: ${product.name}`);
        window.dispatchEvent(
          new CustomEvent('productCreated', { detail: product }),
        );
      });

      newSocket.on('product_updated', (product) => {
        toast.success(`Product updated: ${product.name}`);
        window.dispatchEvent(
          new CustomEvent('productUpdated', { detail: product }),
        );
      });

      newSocket.on('product_deleted', (data) => {
        toast.success('Product deleted successfully');
        window.dispatchEvent(
          new CustomEvent('productDeleted', { detail: data }),
        );
      });

      newSocket.on('barcode_created', (barcode) => {
        toast.success(`New barcode created: ${barcode.barcode}`);
        window.dispatchEvent(
          new CustomEvent('barcodeCreated', { detail: barcode }),
        );
      });

      newSocket.on('barcodes_generated', (data) => {
        toast.success(`${data.quantity} barcodes generated for product`);
        window.dispatchEvent(
          new CustomEvent('barcodesGenerated', { detail: data }),
        );
      });

      newSocket.on('transaction_created', (data) => {
        const { transaction } = data;
        toast.success(
          `${transaction.transaction_type} transaction: ${transaction.quantity} units of ${transaction.product_name}`,
          { duration: 3000 },
        );
        window.dispatchEvent(
          new CustomEvent('transactionCreated', { detail: data }),
        );
      });

      newSocket.on('stock_updated', (data) => {
        // This could trigger a refetch of stock data in components
        // Emit a custom event that components can listen to
        window.dispatchEvent(new CustomEvent('stockUpdated', { detail: data }));
      });

      newSocket.on('new_low_stock_alerts', (alerts) => {
        alerts.forEach((alert) => {
          toast.error(
            `Low stock alert: ${alert.product_name} (${alert.current_stock} remaining)`,
            { duration: 6000 },
          );
        });
      });

      newSocket.on('alerts_resolved', (alerts) => {
        toast.success(`${alerts.length} alert(s) resolved`);
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    } else {
      // Clean up socket when user logs out
      if (socket) {
        socket.close();
        setSocket(null);
        setConnected(false);
      }
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const emit = (event, data) => {
    if (socket && connected) {
      socket.emit(event, data);
    }
  };

  const on = (event, callback) => {
    if (socket) {
      socket.on(event, callback);
      return () => socket.off(event, callback);
    }
  };

  const off = (event, callback) => {
    if (socket) {
      socket.off(event, callback);
    }
  };

  const value = {
    socket,
    connected,
    emit,
    on,
    off,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};
