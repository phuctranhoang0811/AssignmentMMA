type Button = { text?: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };
type Options = { cancelable?: boolean; onDismiss?: () => void };

// shortcut: web supports a message or one action plus cancel; use a modal for multiple actions.
// Use browser dialogs because react-native-web's Alert.alert is a no-op.
export const Alert = {
  alert(title: string, message?: string, buttons?: Button[], options?: Options) {
    if (typeof globalThis.alert !== 'function') return;
    const text = [title, message].filter(Boolean).join('\n\n');
    if (!buttons || buttons.length < 2) {
      globalThis.alert(text);
      buttons?.[0]?.onPress?.();
      return;
    }
    const action = buttons.find(button => button.style !== 'cancel');
    const cancel = buttons.find(button => button.style === 'cancel');
    if (globalThis.confirm(text)) action?.onPress?.();
    else if (cancel?.onPress) cancel.onPress();
    else options?.onDismiss?.();
  },
};
