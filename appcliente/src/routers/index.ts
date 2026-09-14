/* eslint-disable @typescript-eslint/no-unused-vars */
import routerOnboarding from './onboarding';

interface PrefixedRouter {
  route: (app, opts, callback) => void;
  prefix: string;
}

/**
* Array of routes
* Routes are stored in an array with its prefix
* It is later used on the app composer
*/
const router: Array<PrefixedRouter> = [
  {
    route: routerOnboarding,
    prefix: '/onboarding'
  }
];

/**
 * @returns routes.
 */
export = router;
