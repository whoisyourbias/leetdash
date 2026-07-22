 // 왼쪽 서브트리의 모든 값은 현재 노드보다 작다.
 // 오른쪽 서브트리의 모든 값은 현재노드보다 크다.
 // 현재 노드에서 최대, 최소값을 정해주고, 좌우측에서 검증하는 로직을 재귀적으로 호출한다.
 // 왼쪽서브트리에서 valid호출할때, 현재 노드 값을 최대값으로 지정.
 // 오른쪽 서브트리 valid호출시, 현재 노드 값을 최소값으로 지정한다.

 // 한번 꺽였을때, 즉, 루트2->오4->왼3 등도 자동으로 처리된다. 
 // 루트2 -> 오4 할때는 min값에 루트의 값2이 들어가고
 // 오->왼할때는 max값에 오4가 들어간다, 이때 min값은 윗노드에서 받은 값을 그대로 사용한다.
 // 윗노드에서 받은 값을 그대로 사용하기때문에 현재 왼3 서브트리가 오4보다 작은걸 검증하는데에 사용된다.
 // 반대도 마찬가지 
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

    public boolean isValidBST(TreeNode root) {
        return valid(root, null, null);
    }
    
    public boolean valid(TreeNode cur, Integer Min, Integer Max) {
        if (cur == null) return true;

        if ((Min != null && cur.val <= Min) || (Max != null && cur.val >= Max)) return false;

        return (valid(cur.left, Min, cur.val) && // 왼쪽 서브트리의 최대값은 현재 노드의 값, 최소값은  
                    valid(cur.right, cur.val, Max)); //||| 오른쪽 서브트리의 최소값은 현재노드의 값
    }
}
