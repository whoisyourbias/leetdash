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
    public ListNode reverseList(ListNode head) {

        if(head == null){
            return null;
        }

        int count = 1;

        ListNode start = head;
        while(start.next != null){
            start = start.next;

            count++;
        }

        ListNode[] arr = new ListNode[count];

        arr[0] = head;
        for(int i = 1; i < count; i++){
            arr[i] = head.next;
            head = head.next;
        }

        arr[0].next = null;
        start = arr[count-1];

        for(int i = count-2; i >= 0; i--){
            arr[i+1].next = arr[i];
        }

        return start;
    }
}