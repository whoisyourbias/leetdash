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
    public boolean isValidBST(TreeNode root) {

        return check(root.left, root.val, Long.MIN_VALUE) && check(root.right, Long.MAX_VALUE, root.val);
    }

    public boolean check(TreeNode node, long max, long min){

        if(node == null){
            return true;
        }

        if(node.val <= min){
            return false;
        }

        if(node.val >= max){
            return false;
        }

        return check(node.left, node.val, min) && check(node.right, max, node.val);


    }
}