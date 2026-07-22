import java.util.ArrayList;

class Solution {
	public class ListNode {
		int val;
		ListNode next;
		ListNode(int x) { val = x; }
	}
    public ListNode removeNthFromEnd(ListNode head, int n) {
		ArrayList<ListNode> arr = new ArrayList<>();

		ListNode rtn = head;

		for (int i = 0;rtn != null; i++) {
			arr.add(rtn);
			rtn = rtn.next;
		}
        ListNode del = arr.get(arr.size() - n);
        // remove head
		if (arr.size() - n == 0) {
			return del.next;
		}

		ListNode left = arr.get(arr.size() - n - 1);
		left.next = del.next;
		return head;
    }

}
