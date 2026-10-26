// Admin page shell (Hòa): two tables, users and logs. The page does not decide rules;
// it shows what the server returns, with the message from the shared code table.
import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { Table, Alert } from 'antd';
import { adminView } from './admin';

const userColumns = [
  { title: 'id', dataIndex: 'id' },
  { title: 'username', dataIndex: 'username' },
  { title: 'role', dataIndex: 'role' },
  { title: 'group', dataIndex: 'group_id' },
];

const logColumns = [
  { title: 'time', dataIndex: 'created_at' },
  { title: 'code', dataIndex: 'code' },
  { title: 'level', dataIndex: 'level' },
  { title: 'route', dataIndex: 'route' },
  { title: 'ip', dataIndex: 'ip' },
];

function AdminPage({ token }: { token: string }) {
  const [view, setView] = useState({ users: [], logs: [], denied: false, message: '' });

  useEffect(() => {
    adminView(token).then(setView).catch(() => setView({ users: [], logs: [], denied: true, message: 'server error' }));
  }, [token]);

  return (
    <div>
      <Alert type={view.denied ? 'error' : 'info'} message={view.message || 'admin view'} />
      <Table columns={userColumns} dataSource={view.users} rowKey="id" />
      <Table columns={logColumns} dataSource={view.logs} rowKey="code" />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<AdminPage token={process.env.ADMIN_TOKEN || ''} />);
