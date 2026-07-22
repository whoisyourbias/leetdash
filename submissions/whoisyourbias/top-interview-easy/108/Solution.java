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

	// 좌, 우 에서 중간값이 미들노드가되어서
	// 좌측 서브트리의 헤드는 idx/ 2 기준으로 자른 왼쪽 배열의 중간값
	public TreeNode sortedArrayToBST(int[] nums) {
		return bst(nums, 0, nums.length - 1);
	}

	private TreeNode bst(int[] nums, int left, int right) {
		if (left > right) {
			return null;
		}

		int middleIdx = left + (right - left) / 2;
		return new TreeNode(
				nums[middleIdx],
				bst(nums, left, middleIdx - 1),
				bst(nums, middleIdx + 1, right));
	}
}
