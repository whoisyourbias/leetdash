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
    public List<List<Integer>> levelOrder(TreeNode root) {

        List<List<Integer>> result = new ArrayList<>();

        if(root == null){
            return result;
        }
        Queue<TreeNode> queue = new ArrayDeque<>();

        queue.offer(root);
        int depth = 1;
        while(queue.peek() != null){
            List<Integer> level = new ArrayList<>();

            int size = queue.size();
            for(int i = 0; i < size; i++){
                TreeNode node = queue.poll();
                level.add(node.val);

                if(node.left != null){
                    queue.offer(node.left);
                }

                if(node.right != null){
                    queue.offer(node.right);
                }

            }

            result.add(level);
        }

        return result;
    }
}