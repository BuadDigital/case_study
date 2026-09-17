import { ListPager } from "@platform/ui-kit";

/** Mid-list page — page 2 of 8, real item counts. */
export function Default() {
  return (
    <div style={{ maxWidth: 480 }}>
      <ListPager
        page={2}
        pageSize={10}
        totalCount={76}
        totalPages={8}
        onPageChange={() => {}}
      />
    </div>
  );
}

/** First page — previous button disabled. */
export function FirstPage() {
  return (
    <div style={{ maxWidth: 480 }}>
      <ListPager
        page={1}
        pageSize={10}
        totalCount={76}
        totalPages={8}
        onPageChange={() => {}}
      />
    </div>
  );
}

/** Still loading — range shows the em dash placeholder. */
export function Pending() {
  return (
    <div style={{ maxWidth: 480 }}>
      <ListPager
        page={1}
        pageSize={10}
        totalCount={0}
        pending
        onPageChange={() => {}}
      />
    </div>
  );
}
