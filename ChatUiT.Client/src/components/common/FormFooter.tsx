import React from 'react';
import Stack from './Stack';

/** The row of actions under a form, below a line. */
const FormFooter: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <Stack direction="row" align="center" gap="sm" pt="lg" mt="xl" border borderSide="top">{children}</Stack>
);

export default FormFooter;
