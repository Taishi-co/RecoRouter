import { PropsWithChildren } from 'react';
import { IS_H5_ENV } from './env';

export const H5Container = ({ children }: PropsWithChildren) => {
  if (!IS_H5_ENV) {
    return <>{children}</>;
  }

  return <>{children}</>;
};
