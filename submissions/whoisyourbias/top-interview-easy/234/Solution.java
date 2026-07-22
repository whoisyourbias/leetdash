class Solution {
	public class ListNode {
		int val;
		ListNode next;
		ListNode() {}
		ListNode(int val) { this.val = val; }
		ListNode(int val, ListNode next) { this.val = val; this.next = next; }
	}

	public boolean isPalindrome(ListNode head) {
        ListNode slow = head, fast = head;
        ListNode cur =head;

        while (fast != null && fast.next != null) {
            fast = fast.next.next;
            slow = slow.next;
        }

        // 짝수 길이면 fast가 null.
        // 홀수 길이면 null이 아님.
        if (fast != null) {
            // 한칸 더 전진시켜야 검증대상 리스트임.
            slow = slow.next;
        }
        

        // slow는 항상 더 짧은 문자열
        slow = reverseList(slow);
        while (slow != null) {
            if (cur.val != slow.val) {
                return false;
            }

            slow = slow.next;
            cur = cur.next;
        }

        return true;
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
