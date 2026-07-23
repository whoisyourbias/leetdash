/**
 * Definition for a binary tree node.
 * public class TreeNode {
 *     int val;
 *     TreeNode left;
 *     TreeNode right;
 *     TreeNode() {}
 *     TreeNode(int val) { this.val = val; }
 *     TreeNode(int val, TreeNode left, TreeNode right) {
 *         this.val = val;
 *         this.left = left;
 *         this.right = right;
 *     }
 * }
 */
class Solution {
    public TreeNode sortedArrayToBST(int[] nums) {

        if(nums == null || nums.length == 0){
            return null;
        }

        int n = nums.length;

        TreeNode root = new TreeNode();
        root.val = nums[n/2];

        int[] leftnums = new int[n/2];
        for(int i = 0; i < n/2; i++){
            leftnums[i] = nums[i];
        }
        root.left = sortedArrayToBST(leftnums);

        int[] rightnums = new int[n - n/2 - 1];
        for(int i = 0; i < n-n/2-1; i++){
            rightnums[i] = nums[n/2 + i + 1];
        }
        root.right = sortedArrayToBST(rightnums);

        return root;
    }
}