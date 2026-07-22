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


	public boolean isSymmetric(TreeNode root) {
        if (root == null) return true;
        return isMirror(root.left,root.right);
    }

    /*
                        A
                B(t1)           B(t2)
            D   E               E   D
        F   G   H  I         I  H   G   F
        양쪽 서브트리를 t1, t2라고했을때 
        t1.left.val  == t2.right.val
        t2.right.val == t1.left.val 여야한다.
    */
    boolean isMirror(TreeNode t1, TreeNode t2){
        if(t1==null && t2==null) return true;
        if(t1==null || t2==null || t1.val!=t2.val) return false;
        return isMirror(t1.left, t2.right) && isMirror(t1.right, t2.left);
    }
    // public boolean isSymmetric(TreeNode root) {
    //     LinkedList<Integer> left = new LinkedList<>();
    //     LinkedList<Integer> right = new LinkedList<>();


    //     traverseLeft(left, root.left);
    //     traverseRight(right, root.right);

    //     if (left.size() != right.size()) {return false;}

    //     int i = 0;
    //     while (true) {
    //         if (i == left.size()) {
    //             break;
    //         }

    //         if (left.get(i) != right.get(i)) {return false;}
    //         i++;
    //     }

    //     return true;
    // }

    // void traverseLeft(LinkedList<Integer> left, TreeNode cur) {
    //     if (cur == null) {
    //         left.add(null);
    //         return;
    //     }
    //     left.add(cur.val);

    //     traverseLeft(left, cur.left);
    //     traverseLeft(left, cur.right);
    // }

    // void traverseRight(LinkedList<Integer> right, TreeNode cur) {
    //     if (cur == null) {
    //         right.add(null);
    //         return;
    //     }
    //     right.add(cur.val);

    //     traverseRight(right, cur.right);
    //     traverseRight(right, cur.left);
    // }
}
