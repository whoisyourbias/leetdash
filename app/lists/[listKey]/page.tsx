import { notFound } from "next/navigation";
import { ListUsersTable } from "@/app/components/list-users-table";
import { catalog } from "@/lib/catalog";
import { formatCatalogListTitle } from "@/lib/i18n";
import { getListDetail } from "@/lib/progress";

export const dynamicParams = false;

export function generateStaticParams() {
  return catalog.lists.map((list) => ({ listKey: list.key }));
}

export default async function ListDetailPage({ params }: { params: Promise<{ listKey: string }> }) {
  const { listKey } = await params;
  const detail = await getListDetail(listKey);
  if (!detail) {
    notFound();
  }

  const { list, users } = detail;
  const displayTitle = formatCatalogListTitle(list.title);
  const tableUsers = users.map((user) => ({
    id: user.id,
    displayName: user.displayName,
    githubUsername: user.githubUsername,
    progress: user.progress,
  }));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">문제 목록</p>
          <h1>{displayTitle}</h1>
          <p className="lede">
            정렬된 문제 {list.items.length}개.{" "}
            <a className="problem-link" href={list.url} target="_blank" rel="noreferrer">
              원본 목록 열기
            </a>
          </p>
        </div>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>순위</h2>
            <p className="panel-subtitle">진행률 열을 눌러 오름차순과 내림차순으로 정렬합니다</p>
          </div>
        </div>
        {users.length === 0 ? (
          <div className="empty">등록된 활성 사용자가 없습니다.</div>
        ) : (
          <ListUsersTable users={tableUsers} />
        )}
      </section>
    </div>
  );
}
