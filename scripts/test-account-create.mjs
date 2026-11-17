const ep = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const proj = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

async function testCreateAccount() {
  const email = `testuser_${Date.now()}@gmail.com`;
  const password = 'password123';
  const name = 'Test User';

  const res = await fetch(`${ep}/account`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Appwrite-Project': proj,
    },
    body: JSON.stringify({
      userId: 'unique()',
      email,
      password,
      name,
    }),
  });

  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Result:', data);
  return data;
}

testCreateAccount().catch(console.error);
