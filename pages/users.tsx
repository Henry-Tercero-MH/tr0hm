import React from 'react';
import axios from 'axios';
import Link from 'next/link';
import UserBadge from '../components/UserBadge';

type User = { id: number; username: string; bio?: string };

export default function UsersPage({ users }: { users: User[] }) {
  return (
    <main>
      <h1>Usuarios</h1>
      <div style={{ display: 'grid', gap: 8 }}>
        {users.map((u) => (
          <div key={u.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <UserBadge user={u} link showName={true} />
                <div className="muted">{u.bio}</div>
              </div>
              <Link href={`/users/${u.id}`} className="btn btn-ghost">Ver</Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

export async function getServerSideProps() {
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  try {
    const res = await axios.get(`${api}/api/users`);
    return { props: { users: res.data } };
  } catch (err) {
    return { props: { users: [] } };
  }
}
