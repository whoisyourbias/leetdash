import java.util.LinkedList;
import java.util.List;

class Solution {
	public class TreeNode {
		int val;
		TreeNode left;
		TreeNode right;

		TreeNode() {
		}

		TreeNode(int val) {
			this.val = val;
		}

		TreeNode(int val, TreeNode left, TreeNode right) {
			this.val = val;
			this.left = left;
			this.right = right;
		}
	}

	public List<List<Integer>> levelOrder(TreeNode root) {
		List<List<Integer>> l = new LinkedList<>();

		dfs(root, 0, l);

		return l;
	}

	public void dfs(TreeNode cur, int depth, List<List<Integer>> l) {
		if (cur == null) {
			return;
		}

		if (l.size() == depth) {
			l.add(new LinkedList<Integer>());
		}

		l.get(depth).add(cur.val);

		dfs(cur.left, depth + 1, l);
		dfs(cur.right, depth + 1, l);
	}
}
