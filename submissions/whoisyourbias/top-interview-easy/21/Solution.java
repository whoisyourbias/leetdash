
class Solution {

public class ListNode {
    int val;
    ListNode next;
    ListNode() {}
    ListNode(int val) { this.val = val; }
    ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}

	public ListNode mergeTwoLists(ListNode list1, ListNode list2) {
        ListNode rtn = null;
        ListNode rtnHead = null;

        if (rtn == null) {
            if (list1 == null && list2 == null) {
                
            } else if (list1 == null) {
                rtn = new ListNode(list2.val);
                list2 = list2.next;
            } else if (list2 == null) {
                rtn = new ListNode(list1.val);
                list1 = list1.next;
            } else if (list1.val < list2.val) {
                rtn = new ListNode(list1.val);
                list1 = list1.next;
            } else {
                rtn = new ListNode(list2.val);
                list2 = list2.next;
            }
            rtnHead = rtn;
        }

        while (list1 != null && list2 != null) {
            if (list1.val < list2.val) {
                rtn.next = new ListNode(list1.val);
                list1 = list1.next;
            } else {
                rtn.next = new ListNode(list2.val);
                list2 = list2.next;
            }
            rtn = rtn.next;
        }

        while (list1 != null) {
            rtn.next = new ListNode(list1.val);
            list1 = list1.next;
            rtn = rtn.next;
        }

        while (list2 != null) {
            rtn.next = new ListNode(list2.val);
            list2 = list2.next;
            rtn = rtn.next;
        }
        return rtnHead;
    }
}
