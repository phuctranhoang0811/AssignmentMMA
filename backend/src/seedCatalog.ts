import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { mockProducts } from '../../src/data/mockProducts';

async function imageWorks(url: string) {
  try {
    return (await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10_000) })).ok;
  } catch {
    return true; // network trouble is not proof the image is gone
  }
}

// The app currently sells this catalog; add missing documents without replacing managed prices.
async function seedCatalog() {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID is required in backend/.env.');
  const app = initializeApp({ credential: applicationDefault(), projectId });
  const db = getFirestore(app);
  try {
    const refs = mockProducts.map(product => db.collection('products').doc(product.id));
    const docs = await db.getAll(...refs);
    const batch = db.batch();
    const missing = docs.flatMap((doc, index) => doc.exists ? [] : [index]);
    for (const index of missing) batch.create(refs[index], mockProducts[index]);
    // Remote photos can disappear; swap only a dead image for the bundled one, keep every other managed field.
    const repaired: string[] = [];
    for (const [index, doc] of docs.entries()) {
      const stored = doc.data()?.image as string | undefined;
      const bundled = mockProducts[index].image;
      if (!doc.exists || !stored || stored === bundled || await imageWorks(stored) || !await imageWorks(bundled)) continue;
      batch.update(refs[index], { image: bundled });
      repaired.push(doc.id);
    }
    if (missing.length || repaired.length) await batch.commit();
    console.log(`Catalog ${projectId}: added ${missing.length}, repaired images ${repaired.join(', ') || 'none'}, preserved ${docs.length - missing.length} existing products.`);
  } finally {
    await db.terminate();
  }
}

seedCatalog().catch(() => {
  console.error('Catalog sync failed. Check Firebase Admin credentials, project and Firestore access in backend/.env.');
  process.exitCode = 1;
});
