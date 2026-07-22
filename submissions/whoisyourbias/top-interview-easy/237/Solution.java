class Solution {
	public class ListNode {
		int val;
		ListNode next;
		ListNode(int x) { val = x; }
	}
    public void deleteNode(ListNode node) {
        while (node.next != null) {
        	node.val = node.next.val;
			if (node.next.next != null) {
				node = node.next;
			} else {
				node.next = null;
			}

		}
    }
}
