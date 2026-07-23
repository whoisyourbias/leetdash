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
    public boolean isPalindrome(ListNode head) {
        ListNode start = head;

        int count = 1;

        while(start.next != null){
            start = start.next;
            count++;
        }

        int[] arr = new int[count];

        for(int i = 0; i < count; i++){
            arr[i] = head.val;
            head = head.next;
        }

        for(int i = 0; i < count / 2; i++){
            if(arr[i] != arr[count-1-i]){
                return false;
            }
        }

        return true;
    }
}