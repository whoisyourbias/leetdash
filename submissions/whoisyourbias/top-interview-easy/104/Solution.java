class Solution {
	public class TreeNode {
		int val;
		TreeNode left;
		TreeNode right;
		TreeNode() {}
		TreeNode(int val) { this.val = val; }
		TreeNode(int val, TreeNode left, TreeNode right) {
			this.val = val;
			this.left = left;
			this.right = right;
		}
	}

	public int maxDepth(TreeNode root) {
        return dfs(root, 0);
    }

    int dfs(TreeNode cur, int curDepth) {
        if (cur == null) {
            return curDepth;
        }
        return Math.max(dfs(cur.left, curDepth + 1), dfs(cur.right, curDepth + 1
        ));
    }
}
