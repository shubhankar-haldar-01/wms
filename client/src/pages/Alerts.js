import React from 'react';
import { Box, Typography } from '@mui/material';

const Alerts = () => {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Low Stock Alerts
      </Typography>
      <Typography variant="body1">
        This page will show low stock alerts with the ability to resolve or dismiss them.
      </Typography>
    </Box>
  );
};

export default Alerts;