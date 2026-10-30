import { test } from 'node:test';
import assert from 'node:assert/strict';
import { googleAccountProfile, isGmailAddress, type GoogleIdentity } from '../../src/utils/googleAccount';

const identity: GoogleIdentity = {
  uid: 'google-user', email: 'customer@gmail.com', emailVerified: true,
  displayName: 'Khách Google', photoURL: null, providerData: [{ providerId: 'google.com' }],
};

test('Google login requires verified Gmail and Google provider, not an email suffix lookalike', () => {
  for (const email of [null, 'customer@company.com', 'customer@gmail.com.evil', 'a@b@gmail.com', 'a b@gmail.com']) {
    assert.equal(isGmailAddress(email), false);
    assert.throws(() => googleAccountProfile({ ...identity, email }));
  }
  assert.throws(() => googleAccountProfile({ ...identity, emailVerified: false }));
  assert.throws(() => googleAccountProfile({ ...identity, providerData: [{ providerId: 'password' }] }));
  assert.equal(isGmailAddress('customer@GMAIL.COM'), true);
});

test('Google login creates customer profile and leaves phone for checkout to collect', () => {
  const profile = googleAccountProfile(identity);
  assert.equal(profile.id, identity.uid);
  assert.equal(profile.email, identity.email);
  assert.equal(profile.fullname, identity.displayName);
  assert.equal(profile.phone, '');
  assert.equal(profile.role, 'USER');
  assert.equal(profile.rewardPoints, 0); // the welcome points come with the first completed order
  assert.equal(profile.emailVerified, false); // the backend records Google's verification
  assert.equal(profile.hasPassword, false);
  assert.equal(profile.isDemo, false);
});

test('repeat Google login preserves existing points, name and role without trusting stored identity', () => {
  const profile = googleAccountProfile(identity, {
    id: 'wrong-uid', email: 'wrong@gmail.com', fullName: 'Tên đã sửa', phone: '0900000000',
    role: 'EMPLOYEE', rewardPoints: 0,
  });
  assert.equal(profile.id, identity.uid);
  assert.equal(profile.email, identity.email);
  assert.equal(profile.rewardPoints, 0);
  assert.equal(profile.fullname, 'Tên đã sửa');
  assert.equal(profile.role, 'EMPLOYEE');
  assert.equal(profile.phone, '0900000000');
  assert.equal(googleAccountProfile(identity, {}).rewardPoints, 0);
});

test('linked password accounts keep access to password change', () => {
  assert.equal(googleAccountProfile({ ...identity,
    providerData: [...identity.providerData, { providerId: 'password' }],
  }).hasPassword, true);
});
