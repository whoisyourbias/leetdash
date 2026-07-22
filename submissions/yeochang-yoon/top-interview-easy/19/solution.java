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
    public ListNode removeNthFromEnd(ListNode head, int n) {

        int count = 1;

        ListNode start = head;

        while(start.next != null){
            start = start.next;
            count++;
        }

        if(count == 1){
            return null;
        }

        if(count == n){
            return head.next;
        }

        int target = count - n + 1;

        ListNode node = head;
        for(int i = 1; i < target - 1; i++){
            node = node.next;
        }

        node.next = node.next.next;

        return head;
    }
}