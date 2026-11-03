import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Alert } from '../../src/utils/alert.web';

test('web messages display validation errors and run acknowledgment callbacks', t => {
  const messages: string[] = [];
  const original = globalThis.alert;
  globalThis.alert = text => { messages.push(String(text)); };
  t.after(() => { globalThis.alert = original; });
  let returned = false;
  Alert.alert('Thành công', 'Đã đổi mật khẩu', [{ text: 'Đồng ý', onPress: () => { returned = true; } }]);
  assert.equal(messages[0], 'Thành công\n\nĐã đổi mật khẩu');
  assert.equal(returned, true);
  Alert.alert('Thông báo', 'Email chưa hợp lệ');
  assert.match(messages[1], /Email chưa hợp lệ/);
});

test('web cancel and sign-out confirmations never execute an action when declined', t => {
  const originalAlert = globalThis.alert, originalConfirm = globalThis.confirm;
  globalThis.alert = () => {};
  let accepted = false;
  globalThis.confirm = () => accepted;
  t.after(() => { globalThis.alert = originalAlert; globalThis.confirm = originalConfirm; });
  let actions = 0, cancellations = 0;
  const buttons = [{ text: 'Không', style: 'cancel' as const, onPress: () => { cancellations++; } },
    { text: 'Hủy đơn', style: 'destructive' as const, onPress: () => { actions++; } }];
  Alert.alert('Hủy đơn?', 'Chỉ hủy trước khi xác nhận', buttons);
  assert.equal(actions, 0);
  assert.equal(cancellations, 1);
  accepted = true;
  Alert.alert('Hủy đơn?', '', buttons);
  assert.equal(actions, 1);
  assert.equal(cancellations, 1);
});
