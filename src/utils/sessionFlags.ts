// Session flags that persist during the current app/browser session (1 time per session)

const MEMBER_DISCOUNT_SESSION_KEY = '@pizza_fpt_prompted_member_discount_session';
const FREE_SHIP_SESSION_KEY = '@pizza_fpt_prompted_freeship_session';

let memberDiscountPromptedThisSession = false;
let freeShipPromptedThisSession = false;

function readSessionFlag(key: string, memoryFallback: boolean): boolean {
  if (memoryFallback) return true;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage.getItem(key) === '1';
    }
  } catch {
    // Ignore storage access errors
  }
  return memoryFallback;
}

function writeSessionFlag(key: string, value: boolean): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (value) {
        window.sessionStorage.setItem(key, '1');
      } else {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore storage access errors
  }
}

export const hasPromptedMemberDiscount = (): boolean => {
  return readSessionFlag(MEMBER_DISCOUNT_SESSION_KEY, memberDiscountPromptedThisSession);
};

export const setPromptedMemberDiscount = (value: boolean = true): void => {
  memberDiscountPromptedThisSession = value;
  writeSessionFlag(MEMBER_DISCOUNT_SESSION_KEY, value);
};

export const resetMemberDiscountPrompt = (): void => {
  setPromptedMemberDiscount(false);
};

export const hasPromptedFreeShip = (): boolean => {
  return readSessionFlag(FREE_SHIP_SESSION_KEY, freeShipPromptedThisSession);
};

export const setPromptedFreeShip = (value: boolean = true): void => {
  freeShipPromptedThisSession = value;
  writeSessionFlag(FREE_SHIP_SESSION_KEY, value);
};

export const resetFreeShipPrompt = (): void => {
  setPromptedFreeShip(false);
};
