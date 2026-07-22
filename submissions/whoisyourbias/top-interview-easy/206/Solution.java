/**
 * Definition for singly-linked list.
 * public class ListNode {
 *     int val;
 *     ListNode next;
 *     ListNode() {}
 *     ListNode(int val) { this.val = val; }
 *     ListNode(int val, ListNode next) { this.val = val; this.next = next; }
 * }
 */
class Solution {
	public class ListNode {
		int val;
		ListNode next;
		ListNode() {}
		ListNode(int val) { this.val = val; }
		ListNode(int val, ListNode next) { this.val = val; this.next = next; }
	}
    public ListNode reverseList(ListNode head) {
        ListNode cur = head;
        ListNode before = null;
        ListNode next = null;

        while (cur != null) {
            if (before == null) {
                before = cur;
                next = cur.next;
                cur.next = null;    
                cur = next;
                continue;
            } else {
                next = cur.next;
                cur.next = before;
                before = cur;
                cur = next;
                continue;
            }
        }
        return before;
    }
}
