// Admin page (Hòa): the blocks are the admin endpoints, one block each. Nothing here decides
// a rule; a line that the server refused is printed with the server's own message.
import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { Alert, Button, Input, Select, Space, Table } from 'antd';
import { adminView, addCategory, renameCategory, removeCategory, addUnit, renameUnit, removeUnit, forceLogout, login, setRole, type Envelope } from './admin';

type View = Awaited<ReturnType<typeof adminView>>;
const empty: View = { users: [], logs: [], categories: [], units: [], denied: false, message: '' };

export function AdminPage({ startToken = '' }: { startToken?: string }) {
  const [token, setToken] = useState(startToken);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [view, setView] = useState<View>(empty);
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('');

  async function refresh(next = token) {
    if (!next) return;
    setView(await adminView(next));
  }

  function show(out: Envelope) {
    setMessage(`${out.code} — ${out.message}`);
    refresh();
  }

  useEffect(() => {
    refresh(token);
  }, [token]);

  async function signIn() {
    const out = await login(email, password);
    setMessage(`${out.out.code} — ${out.out.message}`);
    if (out.token) setToken(out.token);
  }

  if (!token) {
    return (
      <Space direction="vertical" style={{ width: '100%' }}>
        <h1>Trang quản trị Tủ Lành</h1>
        <p>{message || 'Đăng nhập bằng tài khoản admin.'}</p>
        <Input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input.Password placeholder="mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button onClick={signIn}>Đăng nhập</Button>
      </Space>
    );
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <h1>Trang quản trị Tủ Lành</h1>
      <Alert type={view.denied ? 'error' : 'info'} message={message || view.message} />
      <Table
        size="small"
        rowKey="id"
        dataSource={view.users}
        columns={[
          { title: 'người dùng', dataIndex: 'username' },
          { title: 'nhóm', dataIndex: 'group_id' },
          {
            title: 'quyền',
            dataIndex: 'role',
            render: (_: unknown, row: Record<string, unknown>) => (
              <Select
                size="small"
                value={String(row.role)}
                options={['user', 'group_leader', 'admin'].map((role) => ({ value: role }))}
                onChange={(role) => setRole(token, String(row.id), role).then(show)}
              />
            ),
          },
          {
            title: 'phiên',
            render: (_: unknown, row: Record<string, unknown>) => (
              <Button size="small" onClick={() => forceLogout(token, String(row.id)).then(show)}>
                Đăng xuất cưỡng chế
              </Button>
            ),
          },
        ]}
      />
      <Table
        size="small"
        rowKey="name"
        dataSource={view.categories}
        columns={[
          { title: 'nhóm thực phẩm', dataIndex: 'name' },
          {
            title: 'sửa',
            render: (_: unknown, row: Record<string, unknown>) => (
              <Button size="small" onClick={() => renameCategory(token, String(row.name), `${row.name} 2`).then(show)}>
                Đổi tên
              </Button>
            ),
          },
          {
            title: 'xóa',
            render: (_: unknown, row: Record<string, unknown>) => (
              <Button size="small" danger onClick={() => removeCategory(token, String(row.name)).then(show)}>
                Xóa
              </Button>
            ),
          },
        ]}
      />
      <Space>
        <Input placeholder="thêm nhóm thực phẩm" value={category} onChange={(e) => setCategory(e.target.value)} />
        <Button onClick={() => addCategory(token, category).then(show)}>Thêm</Button>
      </Space>
      <Table
        size="small"
        rowKey="name"
        dataSource={view.units}
        columns={[
          { title: 'đơn vị', dataIndex: 'name' },
          {
            title: 'xóa',
            render: (_: unknown, row: Record<string, unknown>) => (
              <Button size="small" danger onClick={() => removeUnit(token, String(row.name)).then(show)}>
                Xóa
              </Button>
            ),
          },
        ]}
      />
      <Space>
        <Input placeholder="thêm đơn vị" value={unit} onChange={(e) => setUnit(e.target.value)} />
        <Button onClick={() => addUnit(token, unit).then(show)}>Thêm</Button>
      </Space>
      <Table
        size="small"
        rowKey={(row) => `${row.created_at}-${row.code}`}
        dataSource={view.logs}
        columns={[
          { title: 'thời gian', dataIndex: 'created_at' },
          { title: 'mã', dataIndex: 'code' },
          { title: 'mức', dataIndex: 'level' },
          { title: 'đường dẫn', dataIndex: 'route' },
        ]}
      />
    </Space>
  );
}

createRoot(document.getElementById('root')!).render(<AdminPage startToken={process.env.ADMIN_TOKEN || ''} />);
