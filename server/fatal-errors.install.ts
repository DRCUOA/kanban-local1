// Side-effect module: imported first so the handlers exist before any other
// module evaluates (imports are hoisted, so a call in index.ts would run too late).
import { installFatalErrorLogging } from './fatal-errors';

installFatalErrorLogging();
