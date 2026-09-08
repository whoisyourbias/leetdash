import java.util.ArrayDeque;
import java.util.Scanner;

class Solution {
	public static void main(String args[]) throws Exception {

		Scanner sc = new Scanner(System.in);
		int T;
		T = sc.nextInt();

		for (int test_case = 1; test_case <= T; test_case++) {
			ArrayDeque<Character> stack = new ArrayDeque<>();

			String str = sc.next();
			int total = 0;
			for (int i = 0; i < str.length(); i++) {
				char c = str.charAt(i);

				if (c == '(') {
					stack.push(c);
				} else {
					stack.pop();

					if (str.charAt(i - 1) == '(') {
						total += stack.size();
					} else {
						total += 1;
					}
				}
			}

			System.out.println("#" + test_case + " " + total);
		}
	}
}