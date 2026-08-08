// Build a directory tree from a flat file list (each file may carry a
// relative `dir`, e.g. "src/components"). Shared by the Files explorer and
// the auto-generated "Project structure" block in the README tab.

export type TreeFile = {
  name: string;
  dir?: string;
  size?: number;
  type?: string;
  uploaded_at?: string;
  path?: string;
};

export type TreeNode = {
  name: string;
  dir: string;
  children: Map<string, TreeNode>;
  files: TreeFile[];
};

export function buildTree(files: TreeFile[]): TreeNode {
  const root: TreeNode = { name: "", dir: "", children: new Map(), files: [] };
  for (const f of files) {
    const parts = (f.dir ?? "").split("/").filter(Boolean);
    let node = root;
    let currentDir = "";
    for (const part of parts) {
      currentDir = currentDir ? `${currentDir}/${part}` : part;
      let child = node.children.get(part);
      if (!child) {
        child = { name: part, dir: currentDir, children: new Map(), files: [] };
        node.children.set(part, child);
      }
      node = child;
    }
    node.files.push(f);
  }
  return root;
}

/** Render the tree as an ASCII structure diagram (for the README tab). */
export function treeToAscii(root: TreeNode): string {
  const lines: string[] = [];
  const render = (node: TreeNode, prefix: string) => {
    const items: { label: string; node?: TreeNode }[] = [
      ...[...node.children.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((d) => ({ label: `${d.name}/`, node: d })),
      ...[...node.files]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((f) => ({ label: f.name })),
    ];
    items.forEach((item, i) => {
      const last = i === items.length - 1;
      lines.push(`${prefix}${last ? "└── " : "├── "}${item.label}`);
      if (item.node) {
        render(item.node, `${prefix}${last ? "    " : "│   "}`);
      }
    });
  };
  render(root, "");
  return lines.join("\n");
}
