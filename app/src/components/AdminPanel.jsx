import React, { useState, useEffect } from 'react';

export function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [feedbackList, setFeedbackList] = useState([]);
  const [filteredList, setFilteredList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Check password from URL on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlPassword = urlParams.get('password');
    if (urlPassword) {
      setPassword(urlPassword);
      checkAuth(urlPassword);
    }
  }, []);

  const checkAuth = async (pwd) => {
    // For now, we'll implement a simple check
    // The actual password validation will be done on the server side when fetching data
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/list-feedback?password=${encodeURIComponent(pwd)}`);
      if (response.ok) {
        setIsAuthenticated(true);
        loadFeedback(pwd);
      } else {
        setIsAuthenticated(false);
        alert('認証に失敗しました');
      }
    } catch (error) {
      console.error('Auth error:', error);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const loadFeedback = async (pwd) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/list-feedback?password=${encodeURIComponent(pwd)}`);
      if (response.ok) {
        const data = await response.json();
        setFeedbackList(data.items || []);
        setFilteredList(data.items || []);
      }
    } catch (error) {
      console.error('Error loading feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    checkAuth(password);
  };

  const handleDelete = async (id) => {
    if (!confirm('このフィードバックを削除しますか？')) return;

    try {
      const response = await fetch(`/api/admin/delete-feedback?password=${encodeURIComponent(password)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (response.ok) {
        setFeedbackList(feedbackList.filter(f => f.id !== id));
        setFilteredList(filteredList.filter(f => f.id !== id));
        setSelectedFeedback(null);
      } else {
        alert('削除に失敗しました');
      }
    } catch (error) {
      console.error('Error deleting feedback:', error);
      alert('削除に失敗しました');
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const response = await fetch(`/api/admin/update-status?password=${encodeURIComponent(password)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });

      if (response.ok) {
        const updatedList = feedbackList.map(f =>
          f.id === id ? { ...f, status: newStatus } : f
        );
        setFeedbackList(updatedList);
        setFilteredList(updatedList);
        if (selectedFeedback?.id === id) {
          setSelectedFeedback({ ...selectedFeedback, status: newStatus });
        }
      } else {
        alert('ステータス更新に失敗しました');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('ステータス更新に失敗しました');
    }
  };

  const handleExport = (format) => {
    const dataToExport = filteredList.map(f => ({
      ID: f.id,
      カテゴリ: f.type === 'feedback' ? 'ご意見・ご要望' : f.type === 'inquiry' ? 'お問い合わせ' : '不具合報告',
      タイトル: f.title,
      詳細: f.content,
      メールアドレス: f.email || '',
      ステータス: f.status,
      送信日時: new Date(f.timestamp).toLocaleString('ja-JP'),
      国: f.ipCountry,
      言語: f.locale,
    }));

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `feedback-${Date.now()}.json`;
      a.click();
    } else if (format === 'csv') {
      const headers = Object.keys(dataToExport[0] || {}).join(',');
      const rows = dataToExport.map(row =>
        Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
      );
      const csv = [headers, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `feedback-${Date.now()}.csv`;
      a.click();
    }
  };

  // Filter and search
  useEffect(() => {
    let filtered = feedbackList;

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(f => f.type === categoryFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(f =>
        f.title.toLowerCase().includes(query) ||
        f.content.toLowerCase().includes(query)
      );
    }

    setFilteredList(filtered);
    setCurrentPage(1);
  }, [categoryFilter, searchQuery, feedbackList]);

  // Pagination
  const totalPages = Math.ceil(filteredList.length / itemsPerPage);
  const paginatedList = filteredList.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold mb-6 text-center">管理画面ログイン</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">フィードバック管理</h1>
            <div className="flex gap-2">
              <button
                onClick={() => handleExport('csv')}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                CSV出力
              </button>
              <button
                onClick={() => handleExport('json')}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                JSON出力
              </button>
              <button
                onClick={() => loadFeedback(password)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                再読み込み
              </button>
            </div>
          </div>

          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="タイトルまたは内容で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">すべて</option>
              <option value="feedback">ご意見・ご要望</option>
              <option value="inquiry">お問い合わせ</option>
              <option value="bug">不具合報告</option>
            </select>
          </div>

          <div className="text-sm text-gray-600 mb-4">
            {filteredList.length}件のフィードバック
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* List */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-bold mb-4">一覧</h2>
            {loading ? (
              <p className="text-center text-gray-500">読み込み中...</p>
            ) : paginatedList.length === 0 ? (
              <p className="text-center text-gray-500">フィードバックがありません</p>
            ) : (
              <>
                <div className="space-y-2">
                  {paginatedList.map((feedback) => (
                    <div
                      key={feedback.id}
                      onClick={() => setSelectedFeedback(feedback)}
                      className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                        selectedFeedback?.id === feedback.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className={`text-xs px-2 py-1 rounded ${
                          feedback.type === 'feedback' ? 'bg-green-100 text-green-800' : feedback.type === 'inquiry' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {feedback.type === 'feedback' ? 'ご意見・ご要望' : feedback.type === 'inquiry' ? 'お問い合わせ' : '不具合報告'}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          feedback.status === '未対応'
                            ? 'bg-gray-100 text-gray-800'
                            : feedback.status === '対応中'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {feedback.status}
                        </span>
                      </div>
                      <h3 className="font-medium text-sm mb-1">{feedback.title}</h3>
                      <p className="text-xs text-gray-500">
                        {new Date(feedback.timestamp).toLocaleString('ja-JP')}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-4">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                      前へ
                    </button>
                    <span className="px-3 py-1">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                      次へ
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Detail */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-bold mb-4">詳細</h2>
            {selectedFeedback ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">カテゴリ</label>
                  <p>{selectedFeedback.type === 'feedback' ? 'ご意見・ご要望' : selectedFeedback.type === 'inquiry' ? 'お問い合わせ' : '不具合報告'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">タイトル</label>
                  <p>{selectedFeedback.title}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">詳細</label>
                  <p className="whitespace-pre-wrap">{selectedFeedback.content}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">メールアドレス</label>
                  <p>{selectedFeedback.email || 'なし'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">ステータス</label>
                  <select
                    value={selectedFeedback.status}
                    onChange={(e) => handleStatusChange(selectedFeedback.id, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-1"
                  >
                    <option value="未対応">未対応</option>
                    <option value="対応中">対応中</option>
                    <option value="完了">完了</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">送信日時</label>
                  <p>{new Date(selectedFeedback.timestamp).toLocaleString('ja-JP')}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">国 / 言語</label>
                  <p>{selectedFeedback.ipCountry} / {selectedFeedback.locale}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">User Agent</label>
                  <p className="text-xs break-all">{selectedFeedback.userAgent}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">ID</label>
                  <p className="text-xs break-all">{selectedFeedback.id}</p>
                </div>
                <button
                  onClick={() => handleDelete(selectedFeedback.id)}
                  className="w-full bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600"
                >
                  削除
                </button>
              </div>
            ) : (
              <p className="text-center text-gray-500">フィードバックを選択してください</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
