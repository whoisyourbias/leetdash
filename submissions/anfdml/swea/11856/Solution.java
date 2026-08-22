import java.util.Iterator;
import java.util.Scanner;

class Solution
{
	public static void main(String args[]) throws Exception
	{
		
		Scanner sc = new Scanner(System.in);
		int T;
		T=sc.nextInt();
		
		for(int test_case = 1; test_case <= T; test_case++)
		{
			String str = sc.next();
			int arr[] = new int [4];
			
			
			for (int i = 0; i < 4; i++) {
				int count =0;
				for (int j = 0; j < 4; j++) {
					if(str.charAt(i)==str.charAt(j)) {
						count++;
					}
				}
				arr[i] = count;
			}
			boolean yes = true;
			for (int i = 0; i < arr.length; i++) {
				if(arr[i]!=2) {
					yes=false;
				break;
				}
			}
			if(yes) {
				System.out.println("#"+test_case+" "+"Yes");
			}else {
				System.out.println("#"+test_case+" "+ "No");
			}
			
		}
		
	}
}