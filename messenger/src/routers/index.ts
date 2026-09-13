/* eslint-disable @typescript-eslint/no-unused-vars */
import routerOtp from './otp';

interface PrefixedRouter {
  route: (app, opts, callback) => void;
  prefix: string;
}

const router: Array<PrefixedRouter> = [
  {
    route: routerOtp,
    prefix: '/otp'
  },
];

export = router;
