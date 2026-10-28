// In-memory session flags that persist during the app lifecycle

let memberDiscountPromptedThisSession = false;

export const hasPromptedMemberDiscount = (): boolean => {
  return memberDiscountPromptedThisSession;
};

export const setPromptedMemberDiscount = (value: boolean = true): void => {
  memberDiscountPromptedThisSession = value;
};

export const resetMemberDiscountPrompt = (): void => {
  memberDiscountPromptedThisSession = false;
};
